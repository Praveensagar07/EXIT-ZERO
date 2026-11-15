import math
import pytest
from app.simulation.scenarios import SCENARIO_REGISTRY, get_scenario
from app.simulation.engine import SimulationEngine, AlgorithmType, EvacuationState
from app.models.scenario import ScenarioConfig, AlgorithmWeights, ScenarioEvent, ScenarioEventType
from app.models.building import Building, Floor, Room, RoomType, BoundingBox, Doorway, Exit, Stairwell, Point2D, HazardSource, HazardType
from app.models.occupant import MobilityCategory


def test_a_occupant_near_fire_selects_feasible_lower_exposure_path():
    """
    Test A: Occupant near fire with a safe alternative exit.
    Expected: Route avoids impassable hazards and selects a feasible lower-exposure path.
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step to t=10.0s (fire at 68, 8 on Floor 3 has been active for 2s)
    for _ in range(20):
        engine.step(0.5)

    f3_occs = [o for o in engine.occupants if o.floor_id == "floor_3"]
    assert len(f3_occs) > 0

    # Test occupants on F3 north corridor (occ_136, occ_115, occ_102)
    test_agents = [o for o in f3_occs if o.id in ["occ_136", "occ_115", "occ_102"]]
    assert len(test_agents) > 0

    for occ in test_agents:
        # 1. Must be actively evacuating
        assert occ.evacuation_state == EvacuationState.EVACUATING
        # 2. Distance to fire must be increasing or maintained safely >= 4.0m
        dist_to_fire = math.hypot(occ.x - 68.0, occ.y - 8.0)
        assert dist_to_fire >= 4.0, f"{occ.id} is too close to fire: {dist_to_fire}m"
        # 3. Path must NOT contain impassable or burning room edges
        for node_id in occ.current_path[occ.path_index:]:
            assert "R-305" not in node_id
            assert "D-305" not in node_id


def test_b_fire_appears_on_current_route_triggers_immediate_emergency_replanning():
    """
    Test B: Fire appears directly on the current route.
    Expected: Emergency replanning immediately updates path from current position.
    """
    scenario = get_scenario("scenario_normal_evacuation")
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Initial routing
    occ = engine.occupants[0]
    initial_path = list(occ.current_path)
    assert len(initial_path) > 2

    # Step 2 seconds
    for _ in range(4):
        engine.step(0.5)

    # Find next node in occupant's upcoming path
    target_nid = occ.current_path[occ.path_index + 1]
    target_node = engine.nav_model.nodes[target_nid]

    # Inject fire directly at that node
    fire = HazardSource(
        id="dynamic_test_fire",
        floor_id=target_node.floor_id,
        x=target_node.x,
        y=target_node.y,
        hazard_type=HazardType.FIRE,
        start_time_sec=engine.current_time_sec,
        growth_rate=0.50,
        max_radius=10.0,
        intensity=1.0,
    )
    engine.hazards.append(fire)

    # Step one iteration: hazard updates and check_replanning_triggers detects threat
    engine.step(0.5)

    # The occupant's path must have changed to avoid the burning node
    assert target_nid not in occ.current_path or occ.current_path != initial_path


def test_c_fire_blocks_nearest_exit_diverts_to_reachable_safe_exit():
    """
    Test C: Fire blocks the nearest exit.
    Expected: Use another reachable safe exit.
    """
    scenario = get_scenario("scenario_sudden_exit_closure")
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # exit_east_fire is initially open
    east_exit = next(e for e in engine.exits if e.id == "exit_east_fire")
    assert not east_exit.is_blocked

    # Find agents targeting east exit
    east_agents = [o.id for o in engine.occupants if o.target_exit_id == "exit_east_fire"]
    assert len(east_agents) > 0

    # Step until t=19.0s when exit is blocked
    for _ in range(38):
        engine.step(0.5)

    assert east_exit.is_blocked

    # Active agents must no longer target exit_east_fire
    for occ in engine.occupants:
        if occ.id in east_agents and occ.evacuation_state == EvacuationState.EVACUATING:
            assert occ.target_exit_id != "exit_east_fire", f"{occ.id} still targeting blocked exit"


def test_d_fire_blocks_every_exit_reports_trapped_without_teleportation():
    """
    Test D: Fire blocks every exit.
    Expected: No feasible route reported (TRAPPED); no teleportation.
    """
    scenario = get_scenario("scenario_normal_evacuation")
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step 2s to establish positions
    for _ in range(4):
        engine.step(0.5)

    # Block ALL exits
    for e in engine.exits:
        e.is_blocked = True

    # Trigger emergency replanning
    engine._check_replanning_triggers(force_emergency=True)

    # All un-exited occupants must be TRAPPED with empty path and zero speed
    for occ in engine.occupants:
        if occ.evacuation_state != EvacuationState.EXITED:
            assert occ.evacuation_state == EvacuationState.TRAPPED
            assert occ.current_path == []
            assert occ.movement_speed == 0.0


def test_e_smoke_spreads_through_corridor_updates_exposure_costs():
    """
    Test E: Smoke spreads through a corridor.
    Expected: Updated exposure costs and route decisions.
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # At t=0, smoke level on all corridors is 0
    smoke_levels_t0 = [e.smoke_level for e in engine.nav_model.edges]
    assert all(s == 0.0 for s in smoke_levels_t0)

    # Step to t=12.0s (fire and smoke have been expanding)
    for _ in range(24):
        engine.step(0.5)

    # Smoke has propagated to edges near R-305
    smoke_edges = [e for e in engine.nav_model.edges if getattr(e, "smoke_level", 0.0) > 0.0]
    assert len(smoke_edges) > 0

    # Edges with smoke must have higher dynamic traversal costs
    G_view = engine._get_cached_graph(MobilityCategory.STANDARD)
    for e in smoke_edges:
        if G_view.has_edge(e.u, e.v):
            cost = G_view[e.u][e.v]["dynamic_cost"]
            assert cost > e.length / 1.3, f"Edge cost {cost} did not include smoke penalty"


def test_f_hazard_aware_multifloor_stair_routing():
    """
    Test F: Multiple floors connected by stairs.
    Expected: Hazard-aware multi-floor routing avoids compromised vertical connectors.
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step to t=15.0s
    for _ in range(30):
        engine.step(0.5)

    # Occupants on Floor 3 heading down must prefer central ramp or west stair over east stair
    f3_occs = [o for o in engine.occupants if o.floor_id == "floor_3" and o.evacuation_state == EvacuationState.EVACUATING]
    assert len(f3_occs) > 0

    used_safe_vertical = 0
    for occ in f3_occs:
        stair_nodes = [n for n in occ.current_path if "ramp_central" in n or "stair_west" in n]
        if stair_nodes:
            used_safe_vertical += 1

    assert used_safe_vertical > 0, "No occupants routed to safe vertical connectors"


def test_g_wheelchair_occupant_near_fire_considers_only_accessible_routes():
    """
    Test G: Wheelchair occupant near fire.
    Expected: Only accessible feasible routes considered (e.g. ramp_central).
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step to t=10.0s
    for _ in range(20):
        engine.step(0.5)

    f3_wheelchairs = [
        o for o in engine.occupants
        if o.floor_id == "floor_3" and o.mobility_category == MobilityCategory.WHEELCHAIR and o.evacuation_state == EvacuationState.EVACUATING
    ]
    assert len(f3_wheelchairs) > 0

    for occ in f3_wheelchairs:
        # Wheelchair path must NEVER contain inaccessible stairs
        for nid in occ.current_path:
            assert "stair_east" not in nid, f"Wheelchair user {occ.id} routed to stairs!"
            assert "stair_west" not in nid, f"Wheelchair user {occ.id} routed to stairs!"


def test_h_crowded_safe_exit_vs_less_crowded_hazardous_exit():
    """
    Test H: Crowded safe exit versus less-crowded hazardous exit.
    Expected: Respect hard hazard constraints; compare feasible routes using documented costs.
    """
    scenario = get_scenario("scenario_normal_evacuation")
    engine = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Make exit_north_main safe but artificially queued
    north_exit = next(e for e in engine.exits if e.id == "exit_north_main")
    for dummy_i in range(20):
        engine.exit_queues[north_exit.id].append(f"dummy_{dummy_i}")

    # Make exit_east_fire hazardous (high smoke & fire near entrance)
    east_node = engine.nav_model.nodes["node_exit_exit_east_fire"]
    hazard = HazardSource(
        id="fire_east_portal",
        floor_id=east_node.floor_id,
        x=east_node.x - 3.0,
        y=east_node.y,
        hazard_type=HazardType.FIRE,
        start_time_sec=0.0,
        growth_rate=4.0,
        max_radius=15.0,
        intensity=1.0,
    )
    engine.hazards.append(hazard)

    # Step simulation to propagate hazard
    engine.step(1.0)

    # Re-route occupants
    engine._route_all_occupants(is_initial=True)

    # Occupants must NOT route through the hazardous east portal despite north queue
    for occ in engine.occupants:
        if occ.evacuation_state == EvacuationState.EVACUATING:
            assert occ.target_exit_id != "exit_east_fire"


def test_i_baseline_versus_adaptive_hazard_safety():
    """
    Test I: Baseline versus adaptive.
    Expected: Both strategies respect impassability and basic emergency safety constraints.
    Adaptive optimizes predictive congestion and exposure.
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine_base = SimulationEngine(scenario, algorithm=AlgorithmType.BASELINE, seed=42)
    engine_adapt = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Run both engines for 25s
    for _ in range(50):
        engine_base.step(0.5)
        engine_adapt.step(0.5)

    # Both must avoid entering burning room R-305
    for eng in [engine_base, engine_adapt]:
        for occ in eng.occupants:
            if occ.floor_id == "floor_3":
                # Must not be inside R-305
                assert not (65.0 <= occ.x <= 75.0 and 5.0 <= occ.y <= 15.0), f"Occupant inside burning room in {eng.algorithm}!"


def test_j_deterministic_replay_produces_identical_results():
    """
    Test J: Deterministic replay.
    Expected: Identical inputs and seeds produce identical simulation results.
    """
    scenario = SCENARIO_REGISTRY["scenario_multifloor_demo"]
    engine_1 = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)
    engine_2 = SimulationEngine(scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    for _ in range(30):
        engine_1.step(0.5)
        engine_2.step(0.5)

    assert engine_1.current_time_sec == engine_2.current_time_sec
    assert len(engine_1.occupants) == len(engine_2.occupants)

    for o1, o2 in zip(engine_1.occupants, engine_2.occupants):
        assert o1.x == o2.x
        assert o1.y == o2.y
        assert o1.hazard_exposure == o2.hazard_exposure
        assert o1.target_exit_id == o2.target_exit_id
        assert o1.evacuation_state == o2.evacuation_state
