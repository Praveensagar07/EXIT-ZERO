import math
from typing import Dict, List, Optional
from datetime import datetime

import networkx as nx

from app.models.building import Building, Floor, RoomType
from app.models.occupant import Occupant, EvacuationState, MobilityCategory
from app.simulation.engine import SimulationEngine


def _rank_room_routes(
    engine: SimulationEngine,
    room_id: str,
    mobility: MobilityCategory,
    graph: nx.Graph,
) -> List[Dict]:
    """Rank open, reachable exits using the live safety-constrained graph."""
    start_node = f"node_room_{room_id}"
    if start_node not in graph:
        return []

    try:
        paths = nx.single_source_dijkstra_path(graph, start_node, weight="weight")
        costs = nx.single_source_dijkstra_path_length(graph, start_node, weight="weight")
    except (nx.NetworkXError, nx.NodeNotFound):
        return []

    ranked = []
    for exit_elem in engine.exits:
        if exit_elem.is_blocked:
            continue
        if mobility == MobilityCategory.WHEELCHAIR and not exit_elem.is_wheelchair_accessible:
            continue

        exit_node = f"node_exit_{exit_elem.id}"
        path = paths.get(exit_node)
        if not path:
            continue

        distance = 0.0
        max_hazard = 0.0
        max_density = 0.0
        for u_id, v_id in zip(path, path[1:]):
            edge = engine._edge_data.get((u_id, v_id), {})
            edge_obj = edge.get("edge_obj")
            distance += float(edge.get("length", 0.0))
            max_hazard = max(
                max_hazard,
                float(edge.get("hazard_level", 0.0)),
                float(getattr(edge_obj, "hazard_level", 0.0)),
                float(edge.get("fire_level", 0.0)),
                float(edge.get("smoke_level", 0.0)),
            )
            max_density = max(max_density, float(edge.get("current_density", 0.0)))

        ranked.append({
            "exit": exit_elem,
            "path": path,
            "distance": round(distance, 1),
            "cost": float(costs.get(exit_node, distance)),
            "max_hazard": max_hazard,
            "max_density": max_density,
        })

    return sorted(ranked, key=lambda candidate: candidate["cost"])


def generate_building_guidance(engine: SimulationEngine) -> Dict:
    """
    Synthesizes comprehensive, actionable evacuation guidance across four operational tiers:
    1. Building Tier: Overall clearance time, bottleneck vulnerability index, egress readiness rating.
    2. Floor Tier: Floor-by-floor egress progress, active exit distribution, vertical transit assignments.
    3. Room Tier: Assigned primary exit, alternative backup exit, distance (m), estimated egress time (s), status.
    4. Occupant Tier: Turn-by-turn navigation waypoints, remaining distance, dynamic reroute explanations.
    """
    building = engine.scenario.building
    occupants = engine.occupants
    nav_model = engine.nav_model
    exits = engine.exits
    active_evacuees = [o for o in occupants if o.evacuation_state == EvacuationState.EVACUATING]
    exited_count = sum(1 for o in occupants if o.evacuation_state == EvacuationState.EXITED)
    total_occupants = len(occupants)
    progress_pct = round((exited_count / max(1, total_occupants)) * 100.0, 1)

    # 1. Exit Map & Status
    exit_map = {e.id: e for e in exits}
    route_graphs = {
        MobilityCategory.STANDARD: engine._build_traversable_graph(MobilityCategory.STANDARD),
        MobilityCategory.WHEELCHAIR: engine._build_traversable_graph(MobilityCategory.WHEELCHAIR),
    }

    # 2. Floor-Level Guidance & Room-Level Analysis
    floors_guidance = []
    all_rooms_guidance = []

    for floor_idx, floor in enumerate(building.floors):
        floor_occupants = [o for o in occupants if o.floor_id == floor.id]
        floor_evacuated = sum(1 for o in floor_occupants if o.evacuation_state == EvacuationState.EXITED)
        floor_active = sum(1 for o in floor_occupants if o.evacuation_state == EvacuationState.EVACUATING)
        floor_progress = round((floor_evacuated / max(1, len(floor_occupants))) * 100.0, 1) if floor_occupants else 100.0

        # Check hazards on this floor
        floor_hazards = [h for h in engine.hazards if getattr(h, "floor_id", "") == floor.id]
        hazard_risk = "low"
        if floor_hazards:
            max_intensity = max((h.intensity for h in floor_hazards), default=0.0)
            hazard_risk = "critical" if max_intensity >= 0.8 else "high"
        elif any(o.hazard_exposure > 0.05 for o in floor_occupants):
            hazard_risk = "moderate"

        # Recommended vertical connectors
        stair_list = [s.id for s in floor.stairwells if not s.is_ramp]
        ramp_list = [s.id for s in floor.stairwells if s.is_ramp or s.is_wheelchair_accessible]

        # Room guidance for this floor
        rooms_guidance = []
        for room in floor.rooms:
            standard_routes = _rank_room_routes(
                engine,
                room.id,
                MobilityCategory.STANDARD,
                route_graphs[MobilityCategory.STANDARD],
            )
            accessible_routes = (
                _rank_room_routes(
                    engine,
                    room.id,
                    MobilityCategory.WHEELCHAIR,
                    route_graphs[MobilityCategory.WHEELCHAIR],
                )
                if getattr(room, "is_accessible", True)
                else []
            )
            primary_route = standard_routes[0] if standard_routes else None
            alt_route = standard_routes[1] if len(standard_routes) > 1 else None
            accessible_route = accessible_routes[0] if accessible_routes else None
            primary_exit = primary_route["exit"] if primary_route else None
            alt_exit = alt_route["exit"] if alt_route else None
            accessible_exit = accessible_route["exit"] if accessible_route else None

            dist_m = primary_route["distance"] if primary_route else 0.0
            est_time_s = round(dist_m / 1.2, 1) if primary_route else 0.0

            status = "unreachable"
            if primary_route:
                if primary_route["max_hazard"] >= 0.35:
                    status = "hazard_exposed"
                elif primary_route["max_density"] >= 1.8 or (primary_exit.current_queue or 0) > 8:
                    status = "congested"
                else:
                    status = "clear"

            rg = {
                "roomId": room.id,
                "roomName": room.name,
                "floorId": floor.id,
                "floorName": floor.name,
                "primaryExitId": primary_exit.id if primary_exit else "none",
                "primaryExitName": primary_exit.name if primary_exit else "None Available",
                "alternativeExitId": alt_exit.id if alt_exit else "none",
                "alternativeExitName": alt_exit.name if alt_exit else "None Available",
                "routeDistanceMeters": dist_m,
                "estimatedEgressTimeSec": est_time_s,
                "routeNodeIds": primary_route["path"] if primary_route else [],
                "alternativeRouteDistanceMeters": alt_route["distance"] if alt_route else None,
                "status": status,
                "isWheelchairAccessible": getattr(room, "is_accessible", True),
                "accessibleExitId": accessible_exit.id if accessible_exit else "none",
                "accessibleExitName": accessible_exit.name if accessible_exit else "No accessible route",
                "accessibleRouteDistanceMeters": accessible_route["distance"] if accessible_route else None,
                "accessibilityStatus": (
                    "route_available" if accessible_route else
                    "room_not_accessible" if not getattr(room, "is_accessible", True) else
                    "unreachable"
                ),
                "maxCapacity": room.max_capacity,
            }
            rooms_guidance.append(rg)
            all_rooms_guidance.append(rg)

        active_exits_on_floor = [e.id for e in floor.exits if not e.is_blocked]

        floors_guidance.append({
            "floorId": floor.id,
            "floorName": floor.name,
            "level": floor.level,
            "occupantCount": len(floor_occupants),
            "evacuatedCount": floor_evacuated,
            "activeEvacuees": floor_active,
            "evacuationProgressPercent": floor_progress,
            "activeExits": active_exits_on_floor,
            "recommendedStairs": stair_list,
            "recommendedRamps": ramp_list,
            "hazardRisk": hazard_risk,
            "rooms": rooms_guidance,
        })

    # 3. Occupant-Level Guidance (Detailed Waypoints & Dynamic Reroutes)
    occupants_guidance = []
    # Sample up to 40 active or prominent occupants for responsive real-time payload
    sample_occ = active_evacuees[:40] if active_evacuees else occupants[:20]

    for occ in sample_occ:
        target_exit = exit_map.get(occ.target_exit_id)
        target_name = target_exit.name if target_exit else "Unassigned Exit"

        # Compute remaining distance along current path
        rem_dist = 0.0
        turn_instructions = []

        if occ.current_path and occ.path_index < len(occ.current_path):
            curr_target_id = occ.current_path[occ.path_index]
            target_node = nav_model.nodes.get(curr_target_id)
            if target_node:
                rem_dist += math.hypot(target_node.x - occ.x, target_node.y - occ.y)
                turn_instructions.append(f"Advance towards {target_node.label or target_node.id}")

            for p_i in range(occ.path_index, len(occ.current_path) - 1):
                u_id = occ.current_path[p_i]
                v_id = occ.current_path[p_i + 1]
                edge_info = engine._edge_data.get((u_id, v_id))
                if edge_info:
                    rem_dist += edge_info["length"]
                v_node = nav_model.nodes.get(v_id)
                if v_node and len(turn_instructions) < 5:
                    if "stair" in v_id.lower() or "vertical" in v_id.lower():
                        turn_instructions.append(f"Descend via {v_node.label or 'Stairwell'}")
                    elif "door" in v_id.lower():
                        turn_instructions.append(f"Pass through {v_node.label or 'Doorway'}")
                    elif "exit" in v_id.lower():
                        turn_instructions.append(f"Evacuate to safety at {v_node.label or 'Portal'}")

        rem_dist = round(rem_dist, 1)
        est_arrival = round(rem_dist / max(0.5, occ.movement_speed), 1)

        reroute_note = None
        if occ.reroute_count > 0:
            last_ev = next((ev for ev in reversed(engine.reroute_events) if ev.occupant_id == occ.id), None)
            if last_ev:
                reroute_note = f"Dynamically rerouted from {last_ev.previous_exit_id} to {last_ev.new_exit_id} due to {last_ev.reason} (improved arrival by {last_ev.cost_improvement_percent}%)."

        occupants_guidance.append({
            "occupantId": occ.id,
            "mobilityCategory": occ.mobility_category.value,
            "currentFloorId": occ.floor_id,
            "targetExitId": occ.target_exit_id or "none",
            "targetExitName": target_name,
            "distanceRemainingMeters": rem_dist,
            "estimatedArrivalSec": est_arrival,
            "turnByTurnInstructions": turn_instructions if turn_instructions else ["Proceed cautiously to designated primary exit."],
            "rerouteExplanation": reroute_note,
        })

    # 4. Building Bottleneck Index & Readiness Rating
    max_queue = max((e.current_queue or 0 for e in exits), default=0)
    bottleneck_index = min(1.0, round(max_queue / 15.0, 2))

    if any(e.is_blocked for e in exits) or bottleneck_index > 0.7:
        readiness_rating = "constrained" if bottleneck_index < 0.9 else "hazardous"
    elif bottleneck_index > 0.35:
        readiness_rating = "good"
    else:
        readiness_rating = "optimal"

    # Estimated building clearance time
    longest_est = max((o["estimatedArrivalSec"] for o in occupants_guidance), default=45.0)
    est_clearance = round(max(30.0, longest_est * 1.15), 1)

    # 5. Incident Commander Action Checklist
    checklist = [
        "Maintain clear egress priority at all ground-level exterior portals.",
        "Ensure East Accessible Ramp and West Elevator banks are reserved for mobility-impaired occupants.",
    ]
    blocked_exits = [e for e in exits if e.is_blocked]
    if blocked_exits:
        checklist.append(f"URGENT: Divert crowd flows away from blocked portals ({', '.join(e.name for e in blocked_exits)}).")
    if any(h.intensity > 0.5 for h in engine.hazards):
        checklist.append("Deploy smoke extraction fans on upper floors to retard particulate migration.")
    if max_queue >= 8:
        checklist.append("Dispatch crowd marshals to bottlenecked stairwells to prevent turbulent surge compression.")

    return {
        "buildingId": building.id,
        "buildingName": building.name,
        "timestamp": datetime.now().isoformat(),
        "totalOccupants": total_occupants,
        "evacuatedOccupants": exited_count,
        "overallProgressPercent": progress_pct,
        "estimatedClearanceTimeSec": est_clearance,
        "bottleneckRiskIndex": bottleneck_index,
        "egressReadinessRating": readiness_rating,
        "floors": floors_guidance,
        "rooms": all_rooms_guidance,
        "occupantsGuidance": occupants_guidance,
        "emergencyActionChecklist": checklist,
    }


def format_guidance_markdown(guidance: Dict) -> str:
    """Renders structured printable evacuation brief for incident commanders."""
    md = []
    md.append(f"# EXIT-ZERO Evacuation Guidance & Emergency Brief")
    md.append(f"**Facility:** {guidance['buildingName']} (ID: `{guidance['buildingId']}`)")
    md.append(f"**Generated:** {guidance['timestamp']} | **Status:** {guidance['egressReadinessRating'].upper()}")
    md.append(f"**Total Occupants:** {guidance['totalOccupants']} | **Evacuated:** {guidance['evacuatedOccupants']} ({guidance['overallProgressPercent']}%)")
    md.append(f"**Estimated Clearance Time:** {guidance['estimatedClearanceTimeSec']} s | **Bottleneck Index:** {guidance['bottleneckRiskIndex']}")
    md.append("\n---\n")

    md.append("## 1. Incident Commander Operational Checklist")
    for item in guidance["emergencyActionChecklist"]:
        md.append(f"- [ ] {item}")

    md.append("\n## 2. Floor-by-Floor Egress Directives")
    for fl in guidance["floors"]:
        md.append(f"### {fl['floorName']} (Level {fl['level']})")
        md.append(f"- **Occupants:** {fl['occupantCount']} | **Active Evacuees:** {fl['activeEvacuees']} | **Hazard Risk:** `{fl['hazardRisk'].upper()}`")
        md.append(f"- **Recommended Stairs:** {', '.join(fl['recommendedStairs']) if fl['recommendedStairs'] else 'None'}")
        md.append(f"- **Accessible Ramps:** {', '.join(fl['recommendedRamps']) if fl['recommendedRamps'] else 'None'}")

    md.append("\n## 3. Critical Room Egress Assignments")
    md.append("| Room | Floor | Primary Exit | Alt Exit | Distance | Est. Time | Status |")
    md.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for r in guidance["rooms"][:15]:
        md.append(f"| {r['roomName']} | {r['floorName']} | {r['primaryExitName']} | {r['alternativeExitName']} | {r['routeDistanceMeters']} m | {r['estimatedEgressTimeSec']} s | `{r['status'].upper()}` |")

    return "\n".join(md)
