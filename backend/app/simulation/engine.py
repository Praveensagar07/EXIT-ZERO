import copy
import math
import uuid
from collections import deque
from typing import Dict, List, Optional, Set, Tuple
import networkx as nx
import numpy as np

from app.models.building import Exit, Floor, HazardSource, SpawnZone
from app.models.graph import NavigationGraphModel, NodeType
from app.models.occupant import EvacuationState, MobilityCategory, Occupant
from app.models.scenario import (
    AlgorithmType,
    AlgorithmWeights,
    ScenarioConfig,
    ScenarioEvent,
    ScenarioEventType,
)
from app.models.simulation_state import (
    RerouteEvent,
    RouteCostBreakdown,
    SimulationMetrics,
    SimulationState,
    SimulationStatus,
)
from app.simulation.graph_generator import BuildingGraphGenerator


class SimulationEngine:
    """
    Core agent-based emergency evacuation digital twin engine for INNOVEX 2026.
    Implements a shared physical movement substrate (calibrated Weidmann speed-density
    deceleration, corridor density tracking, and FIFO exit queues with fractional service budgets)
    supporting two interchangeable routing strategies:
      - BASELINE: Conventional static shortest-path Dijkstra routing to nearest reachable exit.
      - EXIT-ZERO: Predictive, congestion-aware, hazard-aware, accessibility-aware multi-objective routing.
    """

    # Weidmann pedestrian model parameters (empirical calibration)
    RHO_MAX = 5.4          # Jam / crush density in persons / m^2
    GAMMA = 1.913          # Sensitivity exponent
    MIN_SPEED_RATIO = 0.08 # Minimum crawl speed ratio under crush density

    def __init__(
        self,
        scenario_config: ScenarioConfig,
        algorithm: AlgorithmType = AlgorithmType.BASELINE,
        seed: int = 42,
        occupant_count_override: Optional[int] = None,
        algorithm_weights: Optional[AlgorithmWeights] = None,
        max_time_sec: float = 600.0,
    ):
        self.session_id = str(uuid.uuid4())[:8]
        self.scenario = scenario_config
        self.algorithm = algorithm
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.status = SimulationStatus.IDLE
        self.current_time_sec = 0.0
        self.step_count = 0
        self.max_time_sec = max_time_sec
        self.weights = algorithm_weights or scenario_config.algorithm_weights

        # Target occupant count
        self.target_occupant_count = (
            occupant_count_override
            if occupant_count_override is not None
            else scenario_config.total_occupants
        )

        # 1. Build and validate navigation graph
        self.graph_gen = BuildingGraphGenerator(waypoint_spacing=4.0)
        self.floor: Floor = self.scenario.building.floors[0]
        self.is_multifloor = len(self.scenario.building.floors) > 1

        if self.is_multifloor:
            self.nx_graph, self.nav_model = self.graph_gen.generate_building_graph(self.scenario.building)
            self.topology_audit = self.graph_gen.validate_graph(self.nx_graph, self.nav_model)
            self.exits: List[Exit] = [e.model_copy() for f in self.scenario.building.floors for e in f.exits]
        else:
            self.nx_graph, self.nav_model = self.graph_gen.generate_floor_graph(self.floor)
            self.topology_audit = self.graph_gen.validate_graph(self.nx_graph, self.nav_model)
            self.exits: List[Exit] = [e.model_copy() for e in self.floor.exits]

        # Precompute edge geometric data and lookup maps
        self._edge_data: Dict[Tuple[str, str], Dict] = {}
        for edge in self.nav_model.edges:
            area = max(1.0, edge.length * edge.width)
            edge_key_1 = (edge.u, edge.v)
            edge_key_2 = (edge.v, edge.u)
            info = {
                "length": edge.length,
                "width": edge.width,
                "area": area,
                "capacity_per_sec": edge.capacity_per_sec,
                "wheelchair_accessible": edge.wheelchair_accessible,
                "is_blocked": False,
                "is_impassable": False,
                "edge_obj": edge,
            }
            self._edge_data[edge_key_1] = info
            self._edge_data[edge_key_2] = info

        # 2. Exits, Hazards and Scenario Events
        self.hazards: List[HazardSource] = [h.model_copy() for h in self.scenario.hazard_sources]
        self.events: List[ScenarioEvent] = [ev.model_copy() for ev in self.scenario.events]
        self.executed_event_ids: List[str] = []

        # 3. Queuing Infrastructure
        # Exit ID -> deque of occupant IDs
        self.exit_queues: Dict[str, deque] = {e.id: deque() for e in self.exits}
        # Exit ID -> fractional capacity service budget
        self.exit_service_budgets: Dict[str, float] = {e.id: 0.0 for e in self.exits}
        # Set of occupants currently in or finished through queue
        self._queued_occupant_ids: Set[str] = set()

        # 4. Intelligence & Event Logging
        self.reroute_events: List[RerouteEvent] = []
        self._last_global_replan_time = 0.0

        # Optimization Caches
        self._cached_graphs: Dict[MobilityCategory, nx.Graph] = {}
        self._cached_arrival_times: Dict[str, Dict[str, float]] = {e.id: {} for e in self.exits}

        # Track historical metrics peaks
        self.peak_queue_length: int = 0
        self.peak_density: float = 0.0
        self.time_above_density_threshold_sec: float = 0.0
        self._recent_exited_window: deque = deque() # tuples of (time, count)

        # 5. Spawn initial occupants
        self.occupants: List[Occupant] = self._spawn_occupants()

        # 6. Compute initial routes
        self._route_all_occupants(is_initial=True)

        # 7. Initialize metrics
        self.metrics = self._calculate_current_metrics(dt=0.0)

    def _spawn_occupants(self) -> List[Occupant]:
        occupants: List[Occupant] = []
        zones = self.scenario.spawn_zones
        if not zones:
            return occupants

        total_weight = sum(z.occupant_count for z in zones)
        zone_counts = []
        allocated = 0
        for i, z in enumerate(zones):
            if i == len(zones) - 1:
                cnt = self.target_occupant_count - allocated
            else:
                cnt = int(round((z.occupant_count / max(1, total_weight)) * self.target_occupant_count))
                allocated += cnt
            zone_counts.append(cnt)

        floor_elevations = {f.id: getattr(f, "elevation", 0.0) for f in self.scenario.building.floors}
        occ_idx = 0
        for zone, count in zip(zones, zone_counts):
            zone_floor_id = zone.floor_id if (zone.floor_id and any(f.id == zone.floor_id for f in self.scenario.building.floors)) else self.floor.id
            zone_z = floor_elevations.get(zone_floor_id, 0.0)
            for _ in range(count):
                occ_idx += 1
                px = self.rng.uniform(zone.bounds.x, zone.bounds.x + zone.bounds.width)
                py = self.rng.uniform(zone.bounds.y, zone.bounds.y + zone.bounds.height)

                r_mob = self.rng.random()
                if r_mob < zone.wheelchair_ratio:
                    mob_cat = MobilityCategory.WHEELCHAIR
                    free_speed = float(self.rng.uniform(0.65, 0.85))
                elif r_mob < (zone.wheelchair_ratio + zone.reduced_mobility_ratio):
                    mob_cat = MobilityCategory.REDUCED_SPEED
                    free_speed = float(self.rng.uniform(0.75, 0.95))
                else:
                    mob_cat = MobilityCategory.STANDARD
                    free_speed = float(self.rng.uniform(1.20, 1.45))

                closest_node_id = self._find_nearest_navigable_node(px, py, mob_cat, floor_id=zone_floor_id)

                occ = Occupant(
                    id=f"occ_{occ_idx:03d}",
                    floor_id=zone_floor_id,
                    x=round(px, 2),
                    y=round(py, 2),
                    z=round(zone_z, 2),
                    current_node_id=closest_node_id,
                    movement_speed=round(free_speed, 2),
                    free_speed=round(free_speed, 2),
                    mobility_category=mob_cat,
                    evacuation_state=EvacuationState.EVACUATING,
                    hazard_exposure=0.0,
                    current_path=[],
                    previous_path=[],
                    path_index=0,
                    distance_traveled=0.0,
                    waiting_time_sec=0.0,
                    last_replan_time_sec=0.0,
                    reroute_count=0,
                )
                occupants.append(occ)

        return occupants

    def _find_nearest_navigable_node(
        self, x: float, y: float, mobility: MobilityCategory, floor_id: Optional[str] = None
    ) -> str:
        best_nid = ""
        best_dist = float("inf")

        # 1. Search matching floor
        for nid, node in self.nav_model.nodes.items():
            if floor_id and node.floor_id != floor_id:
                continue
            if mobility == MobilityCategory.WHEELCHAIR and not node.is_accessible:
                continue
            dist = math.hypot(node.x - x, node.y - y)
            if dist < best_dist:
                best_dist = dist
                best_nid = nid

        # 2. Fallback to any floor if empty
        if not best_nid:
            for nid, node in self.nav_model.nodes.items():
                if mobility == MobilityCategory.WHEELCHAIR and not node.is_accessible:
                    continue
                dist = math.hypot(node.x - x, node.y - y)
                if dist < best_dist:
                    best_dist = dist
                    best_nid = nid

        return best_nid if best_nid else list(self.nav_model.nodes.keys())[0]

    def _build_traversable_graph(self, mobility: MobilityCategory) -> nx.Graph:
        """
        Extracts a NetworkX graph view of strictly traversable edges,
        filtering out inaccessible edges (for wheelchairs), physically blocked corridors,
        and corridors engulfed in fire/smoke (hazard_level >= 0.85).
        """
        blocked_exit_nodes = {f"node_exit_{e.id}" for e in self.exits if e.is_blocked}
        valid_edges = []
        for u, v, d in self.nx_graph.edges(data=True):
            if u in blocked_exit_nodes or v in blocked_exit_nodes:
                continue
            info = self._edge_data.get((u, v), {})
            # Check physical blockage or fire impassability
            if info.get("is_blocked", False) or info.get("is_impassable", False):
                continue
            edge_obj = info.get("edge_obj")
            if edge_obj and edge_obj.hazard_level >= 0.85:
                continue

            # Check wheelchair accessibility constraints
            if mobility == MobilityCategory.WHEELCHAIR:
                if not d.get("wheelchair_accessible", True):
                    continue
                node_u = self.nav_model.nodes.get(u)
                node_v = self.nav_model.nodes.get(v)
                if node_u and not node_u.is_accessible:
                    continue
                if node_v and not node_v.is_accessible:
                    continue

            valid_edges.append((u, v))

        return self.nx_graph.edge_subgraph(valid_edges).copy()

    def _invalidate_graph_cache(self):
        """Invalidates graph views when topology changes."""
        self._cached_graphs.clear()

    def _get_cached_graph(self, mobility: MobilityCategory) -> nx.Graph:
        """Retrieves or builds cached traversable subgraph for mobility class."""
        cache_key = MobilityCategory.WHEELCHAIR if mobility == MobilityCategory.WHEELCHAIR else MobilityCategory.STANDARD
        if cache_key not in self._cached_graphs:
            self._cached_graphs[cache_key] = self._build_traversable_graph(cache_key)
        return self._cached_graphs[cache_key]

    def _precompute_arrival_times(self):
        """Precomputes remaining travel time for all active occupants to prevent O(N^2) loops."""
        self._cached_arrival_times = {e.id: {} for e in self.exits}
        for o in self.occupants:
            if o.evacuation_state != EvacuationState.EVACUATING or not o.target_exit_id:
                continue
            rem_dist = 0.0
            if o.current_path and o.path_index < len(o.current_path):
                target_nid = o.current_path[o.path_index]
                target_node = self.nav_model.nodes.get(target_nid)
                if target_node:
                    rem_dist += math.hypot(target_node.x - o.x, target_node.y - o.y)
                for idx in range(o.path_index, len(o.current_path) - 1):
                    info = self._edge_data.get((o.current_path[idx], o.current_path[idx + 1]))
                    if info:
                        rem_dist += info["length"]
            rem_time = rem_dist / max(0.4, o.movement_speed)
            if o.target_exit_id in self._cached_arrival_times:
                self._cached_arrival_times[o.target_exit_id][o.id] = rem_time

    def _get_weidmann_speed(self, free_speed: float, density: float) -> float:
        """
        Calculates effective walking speed under local crowd density using
        the continuous Weidmann model:
        v(rho) = v_0 * [ v_min_ratio + (1 - v_min_ratio) * (1 - exp(-gamma * (1/rho - 1/rho_max))) ]
        """
        if density <= 0.15:
            return round(free_speed, 3)

        if density >= self.RHO_MAX:
            return round(free_speed * self.MIN_SPEED_RATIO, 3)

        term = (1.0 / max(0.01, density)) - (1.0 / self.RHO_MAX)
        weidmann_term = max(0.0, 1.0 - math.exp(-self.GAMMA * term))
        speed_factor = self.MIN_SPEED_RATIO + (1.0 - self.MIN_SPEED_RATIO) * weidmann_term
        speed_factor = max(self.MIN_SPEED_RATIO, min(1.0, speed_factor))

        return round(free_speed * speed_factor, 3)

    def _calculate_edge_densities(self) -> Dict[Tuple[str, str], float]:
        """
        Calculates local crowd density rho (persons / m^2) on every edge of the graph.
        """
        edge_counts: Dict[Tuple[str, str], int] = {k: 0 for k in self._edge_data.keys()}

        for occ in self.occupants:
            if occ.evacuation_state != EvacuationState.EVACUATING:
                continue
            if not occ.current_path or occ.path_index >= len(occ.current_path):
                continue

            prev_node_id = occ.current_path[max(0, occ.path_index - 1)]
            next_node_id = occ.current_path[occ.path_index]
            key = (prev_node_id, next_node_id)
            if key in edge_counts:
                edge_counts[key] += 1
            elif (next_node_id, prev_node_id) in edge_counts:
                edge_counts[(next_node_id, prev_node_id)] += 1

        densities: Dict[Tuple[str, str], float] = {}
        for edge in self.nav_model.edges:
            key1 = (edge.u, edge.v)
            key2 = (edge.v, edge.u)
            count = edge_counts.get(key1, 0) + edge_counts.get(key2, 0)
            area = self._edge_data[key1]["area"]
            rho = round(count / max(1.0, area), 3)

            densities[key1] = rho
            densities[key2] = rho

            edge.current_occupants = count
            edge.current_density = rho

        return densities

    def _estimate_incoming_occupants(
        self, candidate_exit_id: str, candidate_travel_time: float, current_occ_id: str
    ) -> int:
        """
        Predictive Intelligence: Estimates how many other agents will reach candidate_exit_id
        within the lookahead horizon T_horizon (approx 10-30s) before/around this occupant.
        Uses precomputed arrival times for high-performance non-allocating lookups.
        Does NOT mutate actual simulation state.
        """
        arrivals = self._cached_arrival_times.get(candidate_exit_id, {})
        cutoff = candidate_travel_time + self.weights.prediction_horizon_sec
        return sum(1 for oid, rem_time in arrivals.items() if oid != current_occ_id and rem_time <= cutoff)

    def _evaluate_route_cost(
        self,
        occ: Occupant,
        path: List[str],
        exit_elem: Exit,
        edge_densities: Dict[Tuple[str, str], float],
    ) -> Tuple[float, RouteCostBreakdown]:
        """
        Calculates the multi-objective routing cost J(P):
        J(P) = T_travel(P) + w_q * T_queue(exit) + w_h * H(P) + w_c * C(P) + w_r * R(P)
        All terms evaluated in equivalent delay seconds.
        """
        # 1. Travel time
        travel_time = 0.0
        hazard_cost = 0.0
        congestion_cost = 0.0

        for i in range(len(path) - 1):
            u_id = path[i]
            v_id = path[i + 1]
            key = (u_id, v_id)
            info = self._edge_data.get(key)
            if not info:
                continue

            length = info["length"]
            rho = edge_densities.get(key, 0.0)
            v_pred = self._get_weidmann_speed(occ.free_speed, rho)
            travel_time += length / max(0.10, v_pred)

            # Hazard penalty
            edge_obj = info.get("edge_obj")
            h_level = edge_obj.hazard_level if edge_obj else 0.0
            hazard_cost += length * h_level

            # Congestion penalty
            if rho > 1.0:
                congestion_cost += length * (rho - 1.0)

        # 2. Queue delay at target exit
        curr_queue_len = len(self.exit_queues.get(exit_elem.id, []))
        incoming_pred = self._estimate_incoming_occupants(exit_elem.id, travel_time, occ.id)
        effective_queue = curr_queue_len + incoming_pred
        queue_delay = effective_queue / max(0.5, exit_elem.throughput_per_sec)

        # 3. Reroute penalty (hysteresis)
        reroute_penalty = (
            self.weights.w_reroute if (occ.target_exit_id and occ.target_exit_id != exit_elem.id) else 0.0
        )

        # Weighted total
        total_cost = (
            self.weights.w_distance * travel_time
            + self.weights.w_queue * queue_delay
            + self.weights.w_hazard * hazard_cost
            + self.weights.w_congestion * congestion_cost
            + reroute_penalty
        )

        # 4. Accessibility Objectives:
        # A) Avoidable accessible competition:
        # If an ambulatory occupant evaluates an accessible exit when an unblocked stairs exit exists,
        # penalize avoidable queue contention to preserve accessible egress capacity for wheelchair users.
        if occ.mobility_category != MobilityCategory.WHEELCHAIR and exit_elem.is_wheelchair_accessible:
            wc_at_exit = sum(
                1 for o in self.occupants
                if o.mobility_category == MobilityCategory.WHEELCHAIR
                and o.target_exit_id == exit_elem.id
                and o.evacuation_state in [EvacuationState.EVACUATING, EvacuationState.WAITING]
            )
            if wc_at_exit > 0:
                has_stair_option = any(not e.is_wheelchair_accessible and not e.is_blocked for e in self.exits)
                if has_stair_option:
                    w_res = getattr(self.weights, "w_accessibility_reservation", 0.0)
                    if w_res > 0.0:
                        total_cost += w_res * (wc_at_exit / max(1.0, exit_elem.throughput_per_sec))

        # B) Wheelchair detour stabilization:
        # For slow-moving wheelchair users (0.75 m/s), distance is physically expensive.
        # Scale queue delay penalty so they do not take 40-meter detours to avoid transient small queues.
        if occ.mobility_category == MobilityCategory.WHEELCHAIR:
            queue_diff = (self.weights.w_queue - 1.0) * queue_delay
            total_cost -= queue_diff * 0.5

        breakdown = RouteCostBreakdown(
            travel_time_sec=round(travel_time, 2),
            queue_delay_sec=round(queue_delay, 2),
            hazard_penalty_sec=round(hazard_cost * self.weights.w_hazard, 2),
            congestion_penalty_sec=round(congestion_cost * self.weights.w_congestion, 2),
            reroute_penalty_sec=round(reroute_penalty, 2),
            total_cost=round(total_cost, 2),
        )

        return total_cost, breakdown

    def _route_occupant(
        self,
        occ: Occupant,
        edge_densities: Optional[Dict[Tuple[str, str], float]] = None,
        is_emergency: bool = False,
    ) -> bool:
        """
        Routes an occupant according to the active algorithm:
          - BASELINE: Static Dijkstra on edge length to nearest reachable permitted exit.
          - EXIT-ZERO: Multi-objective optimization with hysteresis and congestion prediction.
        Returns True if route was updated/changed.
        """
        if occ.evacuation_state in [EvacuationState.EXITED, EvacuationState.WAITING]:
            return False

        if edge_densities is None:
            edge_densities = self._calculate_edge_densities()

        # Build or retrieve cached traversable subgraph
        G_view = self._get_cached_graph(occ.mobility_category)
        curr_node = occ.current_node_id
        if curr_node not in G_view:
            occ.evacuation_state = EvacuationState.TRAPPED
            return False

        # Identify all candidate open exits
        valid_exits = []
        for exit_elem in self.exits:
            if exit_elem.is_blocked:
                continue
            if occ.mobility_category == MobilityCategory.WHEELCHAIR and not exit_elem.is_wheelchair_accessible:
                continue

            exit_nid = f"node_exit_{exit_elem.id}"
            if exit_nid in G_view:
                valid_exits.append((exit_nid, exit_elem))

        if not valid_exits:
            occ.evacuation_state = EvacuationState.TRAPPED
            occ.current_path = []
            return False

        # Compute shortest paths from curr_node in a single Dijkstra search
        try:
            shortest_paths = nx.single_source_dijkstra_path(G_view, curr_node, weight="weight")
            shortest_lengths = nx.single_source_dijkstra_path_length(G_view, curr_node, weight="weight")
        except Exception:
            shortest_paths = {}
            shortest_lengths = {}

        # Strategy A: BASELINE (Shortest-Path Dijkstra)
        if self.algorithm == AlgorithmType.BASELINE:
            best_dist = float("inf")
            best_path = []
            chosen_exit = None

            for exit_nid, exit_elem in valid_exits:
                if exit_nid in shortest_paths:
                    dist = shortest_lengths[exit_nid]
                    if dist < best_dist:
                        best_dist = dist
                        best_path = shortest_paths[exit_nid]
                        chosen_exit = exit_elem

            if best_path:
                prev_target = occ.target_exit_id
                occ.previous_path = list(occ.current_path) if occ.current_path else []
                occ.current_path = best_path
                occ.path_index = 0
                occ.target_exit_id = chosen_exit.id if chosen_exit else None
                occ.evacuation_state = EvacuationState.EVACUATING
                if prev_target and prev_target != occ.target_exit_id:
                    occ.reroute_count += 1
                    self.reroute_events.append(
                        RerouteEvent(
                            time_sec=self.current_time_sec,
                            occupant_id=occ.id,
                            previous_exit_id=prev_target,
                            new_exit_id=chosen_exit.id if chosen_exit else "",
                            reason="EMERGENCY_OVERRIDE",
                            cost_improvement_percent=0.0,
                        )
                    )
                return prev_target != occ.target_exit_id
            else:
                occ.evacuation_state = EvacuationState.TRAPPED
                return False

        # Strategy B: EXIT-ZERO (Adaptive Multi-Objective Intelligence)
        candidate_evaluations = []
        for exit_nid, exit_elem in valid_exits:
            if exit_nid in shortest_paths:
                path = shortest_paths[exit_nid]
                cost, breakdown = self._evaluate_route_cost(occ, path, exit_elem, edge_densities)
                candidate_evaluations.append((cost, path, exit_elem, breakdown))

        if not candidate_evaluations:
            occ.evacuation_state = EvacuationState.TRAPPED
            occ.current_path = []
            return False

        # Sort candidate exits by objective score J(P)
        candidate_evaluations.sort(key=lambda x: x[0])
        best_cost, best_path, best_exit, best_breakdown = candidate_evaluations[0]

        # Check Hysteresis: only switch if this is initial routing, emergency override,
        # or the new route improves cost by at least hysteresis_threshold (e.g. 20%)
        should_switch = False
        improvement_pct = 0.0

        if not occ.current_path or is_emergency or occ.target_exit_id is None:
            should_switch = True
        elif best_exit.id == occ.target_exit_id:
            # Same exit, keep or smooth path
            should_switch = False
        else:
            current_cost = occ.current_route_cost if occ.current_route_cost > 0 else (best_cost * 1.5)
            if best_cost < current_cost * (1.0 - self.weights.hysteresis_threshold):
                should_switch = True
                improvement_pct = round(((current_cost - best_cost) / current_cost) * 100.0, 1)

        if should_switch:
            prev_exit = occ.target_exit_id
            occ.previous_path = list(occ.current_path)
            occ.current_path = best_path
            occ.path_index = 0
            occ.target_exit_id = best_exit.id
            occ.current_route_cost = best_cost
            occ.evacuation_state = EvacuationState.EVACUATING
            occ.last_replan_time_sec = self.current_time_sec

            # Keep arrival schedule O(1) synchronized within routing pass to prevent herding
            if prev_exit and prev_exit in self._cached_arrival_times:
                self._cached_arrival_times[prev_exit].pop(occ.id, None)
            if best_exit.id in self._cached_arrival_times:
                self._cached_arrival_times[best_exit.id][occ.id] = best_breakdown.travel_time_sec

            if prev_exit and prev_exit != best_exit.id:
                occ.reroute_count += 1
                reason = "EMERGENCY_OVERRIDE" if is_emergency else "CONGESTION_ADVANTAGE"
                self.reroute_events.append(
                    RerouteEvent(
                        time_sec=self.current_time_sec,
                        occupant_id=occ.id,
                        previous_exit_id=prev_exit,
                        new_exit_id=best_exit.id,
                        reason=reason,
                        cost_improvement_percent=improvement_pct,
                    )
                )
            return True

        return False

    def _route_all_occupants(self, is_initial: bool = False):
        """Routes all active occupants."""
        self._precompute_arrival_times()
        densities = self._calculate_edge_densities()
        for occ in self.occupants:
            if occ.evacuation_state == EvacuationState.EXITED:
                continue
            self._route_occupant(occ, edge_densities=densities, is_emergency=is_initial)

    def _update_hazards_and_corridors(self, dt: float) -> bool:
        """
        Propagates fire/smoke hazards and marks engulfed corridors as impassable.
        Accumulates occupant exposure dosage.
        Returns True if any corridor newly became impassable (hazard_level >= 0.85).
        """
        newly_impassable = False
        for hazard in self.hazards:
            if self.current_time_sec >= hazard.start_time_sec:
                time_active = self.current_time_sec - hazard.start_time_sec
                current_radius = min(hazard.max_radius, time_active * hazard.growth_rate)

                # 1. Update edge hazard severity & impassability
                for edge in self.nav_model.edges:
                    u_node = self.nav_model.nodes.get(edge.u)
                    v_node = self.nav_model.nodes.get(edge.v)
                    if not u_node or not v_node:
                        continue

                    # Midpoint distance to hazard
                    mx = (u_node.x + v_node.x) / 2.0
                    my = (u_node.y + v_node.y) / 2.0
                    dist = math.hypot(mx - hazard.x, my - hazard.y)

                    if dist <= current_radius:
                        severity = hazard.intensity * (1.0 - (dist / max(1.0, current_radius)))
                        edge.hazard_level = max(edge.hazard_level, round(severity, 3))
                        if edge.hazard_level >= 0.85:
                            info = self._edge_data.get((edge.u, edge.v))
                            if info and not info.get("is_impassable", False):
                                info["is_impassable"] = True
                                newly_impassable = True
                            info2 = self._edge_data.get((edge.v, edge.u))
                            if info2 and not info2.get("is_impassable", False):
                                info2["is_impassable"] = True
                                newly_impassable = True

                # 2. Accumulate exposure dosage on occupants within hazard zone
                for occ in self.occupants:
                    if occ.evacuation_state == EvacuationState.EXITED:
                        continue
                    dist_to_hazard = math.hypot(occ.x - hazard.x, occ.y - hazard.y)
                    if dist_to_hazard <= current_radius:
                        severity = hazard.intensity * (1.0 - (dist_to_hazard / max(1.0, current_radius)))
                        occ.hazard_exposure = round(occ.hazard_exposure + severity * dt, 4)

        if newly_impassable:
            self._invalidate_graph_cache()

        return newly_impassable

    def _execute_scheduled_scenario_events(self) -> bool:
        """
        Executes scenario events (e.g. exit blockage at t=18s) when scheduled time is reached.
        Returns True if an event caused an emergency route change.
        """
        emergency_trigger = False

        for idx, event in enumerate(self.events):
            event_id = f"ev_{idx}_{event.time_sec}_{event.event_type.value}"
            if event_id in self.executed_event_ids:
                continue

            if self.current_time_sec >= event.time_sec:
                self.executed_event_ids.append(event_id)

                if event.event_type == ScenarioEventType.BLOCK_EXIT:
                    exit_elem = next((e for e in self.exits if e.id == event.target_id), None)
                    if exit_elem:
                        exit_elem.is_blocked = True
                        emergency_trigger = True
                elif event.event_type == ScenarioEventType.UNBLOCK_EXIT:
                    exit_elem = next((e for e in self.exits if e.id == event.target_id), None)
                    if exit_elem:
                        exit_elem.is_blocked = False
                        emergency_trigger = True
                elif event.event_type == ScenarioEventType.BLOCK_CORRIDOR:
                    if event.target_id and event.secondary_target_id:
                        key1 = (event.target_id, event.secondary_target_id)
                        key2 = (event.secondary_target_id, event.target_id)
                        if key1 in self._edge_data:
                            self._edge_data[key1]["is_blocked"] = True
                        if key2 in self._edge_data:
                            self._edge_data[key2]["is_blocked"] = True
                        emergency_trigger = True

        if emergency_trigger:
            self._invalidate_graph_cache()
        return emergency_trigger

    def toggle_exit_block(self, exit_id: str) -> bool:
        """
        Interactive control: Allows user to dynamically block or unblock an exit via API.
        """
        exit_elem = next((e for e in self.exits if e.id == exit_id), None)
        if not exit_elem:
            return False

        exit_elem.is_blocked = not exit_elem.is_blocked
        self._invalidate_graph_cache()
        # Trigger emergency replanning for agents targeting this exit
        self._check_replanning_triggers(force_emergency=True)
        return True

    def _check_replanning_triggers(self, force_emergency: bool = False):
        """
        Evaluates whether dynamic replanning should be triggered for occupants:
          - Periodic check every replan_interval_sec.
          - Emergency override if an occupant's target exit or corridor is blocked.
        """
        is_periodic = (self.current_time_sec - self._last_global_replan_time) >= self.weights.replan_interval_sec
        if not (is_periodic or force_emergency):
            return

        if force_emergency:
            self._invalidate_graph_cache()

        densities = self._calculate_edge_densities()
        self._last_global_replan_time = self.current_time_sec
        self._precompute_arrival_times()

        for occ in self.occupants:
            if occ.evacuation_state in [EvacuationState.EXITED, EvacuationState.WAITING]:
                continue

            # Check if current target exit became blocked
            current_target_exit = next((e for e in self.exits if e.id == occ.target_exit_id), None)
            target_blocked = current_target_exit.is_blocked if current_target_exit else False

            # Check if any upcoming path node/edge is blocked or impassable
            path_blocked = False
            if occ.current_path and occ.path_index < len(occ.current_path):
                for i in range(occ.path_index, len(occ.current_path) - 1):
                    u_id = occ.current_path[i]
                    v_id = occ.current_path[i + 1]
                    info = self._edge_data.get((u_id, v_id), {})
                    if info.get("is_blocked", False) or info.get("is_impassable", False):
                        path_blocked = True
                        break

            is_emergency = target_blocked or path_blocked or force_emergency

            # For Baseline: ONLY replan if emergency (target or path is physically blocked)
            if self.algorithm == AlgorithmType.BASELINE:
                if is_emergency:
                    self._route_occupant(occ, edge_densities=densities, is_emergency=True)
            else:
                # For EXIT-ZERO: Replan either on emergency or on periodic predictive evaluation
                self._route_occupant(occ, edge_densities=densities, is_emergency=is_emergency)

    def step(self, dt: float = 0.5) -> SimulationState:
        """
        Advances the discrete-event simulation by dt seconds with physically-constrained
        crowd dynamics, Weidmann congestion deceleration, and FIFO exit queue service.
        """
        if self.status == SimulationStatus.COMPLETED:
            return self.get_state()

        self.status = SimulationStatus.RUNNING
        self.current_time_sec = round(self.current_time_sec + dt, 2)
        self.step_count += 1

        # 1. Update Hazards and Corridors
        hazard_impassable = self._update_hazards_and_corridors(dt)

        # 2. Execute Scheduled Scenario Events
        emergency_event = self._execute_scheduled_scenario_events()

        # 3. Intelligent Replanning Check
        self._check_replanning_triggers(force_emergency=(emergency_event or hazard_impassable))

        # 4. Compute Local Edge Densities
        edge_densities = self._calculate_edge_densities()
        if any(rho >= 3.0 for rho in edge_densities.values()):
            self.time_above_density_threshold_sec = round(self.time_above_density_threshold_sec + dt, 2)

        # 5. Advance Active Occupants along Routes (Shared Movement Physics)
        for occ in self.occupants:
            if occ.evacuation_state in [EvacuationState.EXITED, EvacuationState.TRAPPED]:
                continue

            if occ.evacuation_state == EvacuationState.WAITING:
                occ.waiting_time_sec = round(occ.waiting_time_sec + dt, 2)
                continue

            if not occ.current_path or occ.path_index >= len(occ.current_path):
                self._handle_occupant_reach_exit(occ)
                continue

            target_node_id = occ.current_path[occ.path_index]
            target_node = self.nav_model.nodes.get(target_node_id)
            if not target_node:
                continue

            prev_node_id = occ.current_path[max(0, occ.path_index - 1)]
            edge_key = (prev_node_id, target_node_id)
            local_rho = edge_densities.get(edge_key, 0.0)

            # Apply Weidmann deceleration
            effective_speed = self._get_weidmann_speed(occ.free_speed, local_rho)

            # Smoke exposure speed penalty
            if occ.hazard_exposure > 0:
                hazard_factor = max(0.60, 1.0 - min(0.40, occ.hazard_exposure * 0.1))
                effective_speed = max(0.10, round(effective_speed * hazard_factor, 3))

            occ.movement_speed = effective_speed

            target_z = getattr(target_node, "z", 0.0)
            occ_z = getattr(occ, "z", 0.0)
            dx = target_node.x - occ.x
            dy = target_node.y - occ.y
            dz = target_z - occ_z
            dist = math.hypot(dx, dy, dz)
            step_dist = effective_speed * dt

            if dist <= step_dist or dist < 0.25:
                occ.x = target_node.x
                occ.y = target_node.y
                occ.z = target_z
                occ.floor_id = target_node.floor_id
                occ.distance_traveled = round(occ.distance_traveled + dist, 2)
                occ.current_node_id = target_node_id
                occ.path_index += 1

                if target_node.node_type == NodeType.EXIT:
                    self._handle_occupant_reach_exit(occ)
            else:
                nx_dir = dx / dist
                ny_dir = dy / dist
                nz_dir = dz / dist
                occ.x = round(occ.x + nx_dir * step_dist, 2)
                occ.y = round(occ.y + ny_dir * step_dist, 2)
                occ.z = round(occ.z + nz_dir * step_dist, 2)
                occ.floor_id = target_node.floor_id
                occ.distance_traveled = round(occ.distance_traveled + step_dist, 2)

        # 6. Service Doorway and Exit Queues with Fractional Capacity Accumulation
        serviced_this_step = self._service_exit_queues(dt)

        self._recent_exited_window.append((self.current_time_sec, serviced_this_step))
        while self._recent_exited_window and (self.current_time_sec - self._recent_exited_window[0][0]) > 5.0:
            self._recent_exited_window.popleft()

        for exit_elem in self.exits:
            q_len = len(self.exit_queues.get(exit_elem.id, []))
            exit_elem.current_queue = q_len
            node_id = f"node_exit_{exit_elem.id}"
            if node_id in self.nav_model.nodes:
                self.nav_model.nodes[node_id].queue_length = q_len

        # 7. Calculate Telemetry Metrics
        self.metrics = self._calculate_current_metrics(dt=dt)

        # 8. Check Completion Condition or Max Time
        active_count = sum(
            1 for o in self.occupants if o.evacuation_state in [EvacuationState.EVACUATING, EvacuationState.WAITING]
        )
        if active_count == 0 or self.current_time_sec >= self.max_time_sec:
            self.status = SimulationStatus.COMPLETED

        return self.get_state()

    def _handle_occupant_reach_exit(self, occ: Occupant):
        """Enqueues an occupant who has reached an exit portal into that exit's FIFO queue."""
        if occ.id in self._queued_occupant_ids:
            return

        exit_elem = None
        if occ.target_exit_id:
            exit_elem = next((e for e in self.exits if e.id == occ.target_exit_id), None)
        if not exit_elem:
            exit_elem = min(self.exits, key=lambda e: math.hypot(e.x - occ.x, e.y - occ.y))

        if exit_elem.is_blocked:
            occ.evacuation_state = EvacuationState.TRAPPED
            return

        if occ.mobility_category == MobilityCategory.WHEELCHAIR and not exit_elem.is_wheelchair_accessible:
            occ.evacuation_state = EvacuationState.TRAPPED
            return

        self._queued_occupant_ids.add(occ.id)
        self.exit_queues[exit_elem.id].append(occ.id)
        occ.evacuation_state = EvacuationState.WAITING

        queue_pos = len(self.exit_queues[exit_elem.id])
        offset = min(6.0, queue_pos * 0.45)
        exit_floor = next((f for f in self.scenario.building.floors if f.id == exit_elem.floor_id), self.floor)
        occ.floor_id = exit_elem.floor_id
        occ.z = getattr(exit_floor, "elevation", 0.0)
        occ.x = round(exit_elem.x + (0.5 if exit_elem.x < exit_floor.width / 2 else -0.5) * offset, 2)
        occ.y = round(exit_elem.y + (self.rng.uniform(-0.3, 0.3)), 2)

    def _service_exit_queues(self, dt: float) -> int:
        """Services exit queues with strictly bounded fractional throughput accumulation."""
        total_exited_step = 0

        for exit_elem in self.exits:
            if exit_elem.is_blocked:
                continue

            q = self.exit_queues[exit_elem.id]
            if not q:
                # Prevent idle exits from banking unlimited unused capacity
                self.exit_service_budgets[exit_elem.id] = min(1.0, self.exit_service_budgets[exit_elem.id])
                continue

            # Accumulate fractional capacity budget: throughput (pers/s) * dt (s)
            self.exit_service_budgets[exit_elem.id] += exit_elem.throughput_per_sec * dt

            available_budget = int(math.floor(self.exit_service_budgets[exit_elem.id]))
            service_count = min(available_budget, len(q))

            for _ in range(service_count):
                occ_id = q.popleft()
                occ = next((o for o in self.occupants if o.id == occ_id), None)
                if occ and occ.evacuation_state != EvacuationState.EXITED:
                    occ.evacuation_state = EvacuationState.EXITED
                    occ.evacuation_time_sec = self.current_time_sec
                    exit_elem.total_exited += 1
                    total_exited_step += 1

            self.exit_service_budgets[exit_elem.id] -= service_count

        return total_exited_step

    def _calculate_current_metrics(self, dt: float = 0.5) -> SimulationMetrics:
        total = len(self.occupants)
        evacuated = sum(1 for o in self.occupants if o.evacuation_state == EvacuationState.EXITED)
        trapped = sum(1 for o in self.occupants if o.evacuation_state == EvacuationState.TRAPPED)
        waiting = sum(1 for o in self.occupants if o.evacuation_state == EvacuationState.WAITING)
        moving = sum(1 for o in self.occupants if o.evacuation_state == EvacuationState.EVACUATING)
        completion_pct = round((evacuated / max(1, total)) * 100.0, 1)

        evac_times = [
            o.evacuation_time_sec
            for o in self.occupants
            if o.evacuation_state == EvacuationState.EXITED and o.evacuation_time_sec is not None
        ]

        median_time = float(np.median(evac_times)) if evac_times else None
        p95_time = float(np.percentile(evac_times, 95)) if len(evac_times) >= 5 else (max(evac_times) if evac_times else None)
        total_time = max(evac_times) if len(evac_times) == total and total > 0 else None

        total_exposure = round(sum(o.hazard_exposure for o in self.occupants), 2)

        active_edge_densities = [
            e.current_density for e in self.nav_model.edges if e.current_occupants > 0
        ]
        mean_density = round(sum(active_edge_densities) / max(1, len(active_edge_densities)), 2) if active_edge_densities else 0.0
        current_max_density = max([e.current_density for e in self.nav_model.edges], default=0.0)
        self.peak_density = max(self.peak_density, current_max_density)

        current_queue_total = sum(len(q) for q in self.exit_queues.values())
        peak_single_queue = max([len(q) for q in self.exit_queues.values()], default=0)
        self.peak_queue_length = max(self.peak_queue_length, peak_single_queue)

        moving_speeds = [o.movement_speed for o in self.occupants if o.evacuation_state == EvacuationState.EVACUATING]
        mean_speed = round(sum(moving_speeds) / max(1, len(moving_speeds)), 2) if moving_speeds else 0.0

        window_exits = sum(cnt for _, cnt in self._recent_exited_window)
        window_duration = (
            (self._recent_exited_window[-1][0] - self._recent_exited_window[0][0])
            if len(self._recent_exited_window) > 1
            else dt
        )
        throughput_rate = round(window_exits / max(0.5, window_duration), 2)

        mean_wait = round(sum(o.waiting_time_sec for o in self.occupants) / max(1, total), 2)

        unreachable_wheelchair = sum(
            1 for o in self.occupants
            if o.mobility_category == MobilityCategory.WHEELCHAIR and o.evacuation_state == EvacuationState.TRAPPED
        )
        wheelchair_occupants = [
            o for o in self.occupants if o.mobility_category == MobilityCategory.WHEELCHAIR
        ]
        wheelchair_evac_times = [
            o.evacuation_time_sec
            for o in wheelchair_occupants
            if o.evacuation_state == EvacuationState.EXITED and o.evacuation_time_sec is not None
        ]
        wheelchair_count = len(wheelchair_occupants)
        wheelchair_evacuated = len(wheelchair_evac_times)
        wheelchair_completion_pct = round(
            (wheelchair_evacuated / max(1, wheelchair_count)) * 100.0, 1
        ) if wheelchair_count else 100.0
        wheelchair_mean_time = (
            float(np.mean(wheelchair_evac_times)) if wheelchair_evac_times else None
        )
        wheelchair_p95_time = (
            float(np.percentile(wheelchair_evac_times, 95))
            if len(wheelchair_evac_times) >= 5
            else (max(wheelchair_evac_times) if wheelchair_evac_times else None)
        )

        total_reroutes_count = sum(o.reroute_count for o in self.occupants)
        is_complete = (evacuated == total and total > 0)

        return SimulationMetrics(
            total_evacuated=evacuated,
            total_occupants=total,
            completion_percentage=completion_pct,
            elapsed_time_sec=self.current_time_sec,
            total_evacuation_time_sec=total_time,
            median_evacuation_time_sec=round(median_time, 2) if median_time else None,
            p95_evacuation_time_sec=round(p95_time, 2) if p95_time else None,
            mean_crowd_density=mean_density,
            max_crowd_density=round(self.peak_density, 2),
            current_exit_queue_length=current_queue_total,
            max_exit_queue_length=self.peak_queue_length,
            mean_occupant_speed=mean_speed,
            current_exit_throughput=throughput_rate,
            mean_waiting_time_sec=mean_wait,
            trapped_occupants=trapped,
            wheelchair_unreachable_count=unreachable_wheelchair,
            wheelchair_occupant_count=wheelchair_count,
            wheelchair_evacuated_count=wheelchair_evacuated,
            wheelchair_completion_percentage=wheelchair_completion_pct,
            mean_wheelchair_evacuation_time_sec=(
                round(wheelchair_mean_time, 2) if wheelchair_mean_time is not None else None
            ),
            p95_wheelchair_evacuation_time_sec=(
                round(wheelchair_p95_time, 2) if wheelchair_p95_time is not None else None
            ),
            total_reroutes=total_reroutes_count,
            unnecessary_reroutes=0,
            time_above_density_threshold_sec=self.time_above_density_threshold_sec,
            cumulative_hazard_exposure=total_exposure,
            is_evacuation_complete=is_complete,
            peak_memory_mb=0.0,
            simulation_execution_time_ms=0.0,
        )

    def get_state(self) -> SimulationState:
        return SimulationState(
            session_id=self.session_id,
            scenario_id=self.scenario.id,
            algorithm=self.algorithm,
            status=self.status,
            current_time_sec=self.current_time_sec,
            step_count=self.step_count,
            seed=self.seed,
            graph=self.nav_model,
            occupants=self.occupants,
            exits=self.exits,
            hazards=self.hazards,
            metrics=self.metrics,
            reroute_events=self.reroute_events[-50:], # return last 50 events for UI
            executed_event_ids=self.executed_event_ids,
        )
