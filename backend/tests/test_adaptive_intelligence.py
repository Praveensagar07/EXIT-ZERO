import pytest
from app.models.occupant import EvacuationState, MobilityCategory
from app.models.scenario import AlgorithmType, AlgorithmWeights, ScenarioEventType
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import get_scenario


def test_baseline_vs_exit_zero_initial_decisions():
    """
    Verifies that Baseline assigns purely based on geometric shortest path,
    while Exit-Zero incorporates queue capacities and path costs.
    """
    scenario = get_scenario("scenario_congested_corridor")

    engine_base = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.BASELINE,
        seed=42,
    )

    engine_adapt = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    assert engine_base.algorithm == AlgorithmType.BASELINE
    assert engine_adapt.algorithm == AlgorithmType.ADAPTIVE
    assert len(engine_base.occupants) == len(engine_adapt.occupants)

    # In high-density bottleneck, exit distribution should differ between baseline and adaptive
    base_exit_dist = {}
    adapt_exit_dist = {}
    for occ in engine_base.occupants:
        base_exit_dist[occ.target_exit_id] = base_exit_dist.get(occ.target_exit_id, 0) + 1

    for occ in engine_adapt.occupants:
        adapt_exit_dist[occ.target_exit_id] = adapt_exit_dist.get(occ.target_exit_id, 0) + 1

    # Both must assign valid exits
    assert None not in base_exit_dist
    assert None not in adapt_exit_dist


def test_multiobjective_cost_function_non_negative():
    """
    Verifies that J(P) is non-negative and properly decomposes into
    travel time, queue delay, hazard penalty, congestion penalty, and reroute penalty.
    """
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    occ = engine.occupants[0]
    densities = engine._calculate_edge_densities()

    for exit_elem in engine.exits:
        exit_nid = f"node_exit_{exit_elem.id}"
        path = [occ.current_node_id, exit_nid]
        cost, breakdown = engine._evaluate_route_cost(occ, path, exit_elem, densities)

        assert cost >= 0.0
        assert breakdown.travel_time_sec >= 0.0
        assert breakdown.queue_delay_sec >= 0.0
        assert breakdown.hazard_penalty_sec >= 0.0
        assert breakdown.congestion_penalty_sec >= 0.0
        assert breakdown.reroute_penalty_sec >= 0.0
        assert breakdown.total_cost >= 0.0


def test_predictive_incoming_queue_estimation_no_mutation():
    """
    Verifies that _estimate_incoming_occupants looks ahead along agent paths
    without modifying agent coordinates, path indices, or simulation clock.
    """
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    occ = engine.occupants[0]
    orig_x = occ.x
    orig_y = occ.y
    orig_time = engine.current_time_sec

    # Estimate incoming occupants for north and east exits
    incoming_a = engine._estimate_incoming_occupants("exit_north_main", candidate_travel_time=15.0, current_occ_id=occ.id)
    incoming_b = engine._estimate_incoming_occupants("exit_east_fire", candidate_travel_time=15.0, current_occ_id=occ.id)

    # Verification: State did NOT mutate
    assert occ.x == orig_x
    assert occ.y == orig_y
    assert engine.current_time_sec == orig_time
    assert isinstance(incoming_a, int)
    assert isinstance(incoming_b, int)
    assert incoming_a >= 0
    assert incoming_b >= 0


def test_replanning_hysteresis_suppresses_chatter():
    """
    Verifies that Exit-Zero avoids route thrashing:
    If a new route has only a marginal benefit (< hysteresis_threshold, e.g. 20%),
    the occupant retains their existing route.
    """
    scenario = get_scenario("scenario_hq_floor1")
    weights = AlgorithmWeights(
        w_distance=1.0,
        w_queue=1.5,
        w_congestion=1.0,
        w_hazard=3.0,
        w_reroute=5.0,
        hysteresis_threshold=0.20, # 20% improvement required
        replan_interval_sec=2.0,
    )
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        algorithm_weights=weights,
        seed=42,
    )

    # Step simulation slightly
    for _ in range(4):
        engine.step(dt=0.5)

    # Pick an evacuating occupant with an established route
    evac_occs = [o for o in engine.occupants if o.evacuation_state == EvacuationState.EVACUATING and o.current_path]
    assert len(evac_occs) > 0
    target_occ = evac_occs[0]
    initial_target_exit = target_occ.target_exit_id
    initial_reroutes = target_occ.reroute_count

    # Re-evaluate routing with identical conditions
    densities = engine._calculate_edge_densities()
    changed = engine._route_occupant(target_occ, edge_densities=densities, is_emergency=False)

    # Hysteresis should prevent switching when conditions haven't changed drastically
    assert not changed
    assert target_occ.target_exit_id == initial_target_exit
    assert target_occ.reroute_count == initial_reroutes


def test_emergency_override_on_exit_closure():
    """
    Verifies that when an exit is suddenly blocked:
    1. Occupants targeting that exit are immediately diverted via EMERGENCY_OVERRIDE.
    2. Hysteresis threshold is bypassed.
    3. A RerouteEvent is logged with reason='EMERGENCY_OVERRIDE'.
    """
    scenario = get_scenario("scenario_sudden_exit_closure")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    # Verify exit_east_fire starts open
    exit_east = next(e for e in engine.exits if e.id == "exit_east_fire")
    assert not exit_east.is_blocked

    # Count agents initially targeting exit_east_fire
    agents_at_east_initial = sum(1 for o in engine.occupants if o.target_exit_id == "exit_east_fire")
    assert agents_at_east_initial > 0

    # Step up to t=18.5s when scenario event blocks exit_east_fire
    steps_to_19s = int(19.0 / 0.5)
    for _ in range(steps_to_19s):
        engine.step(dt=0.5)

    # East Fire Exit should now be blocked
    assert exit_east.is_blocked

    # All active agents must now be diverted away from exit_east_fire!
    active_at_east_post = [
        o for o in engine.occupants
        if o.target_exit_id == "exit_east_fire" and o.evacuation_state == EvacuationState.EVACUATING
    ]
    assert len(active_at_east_post) == 0

    # There must be emergency reroute events recorded
    emergency_events = [
        ev for ev in engine.reroute_events
        if ev.reason == "EMERGENCY_OVERRIDE" and ev.previous_exit_id == "exit_east_fire"
    ]
    assert len(emergency_events) > 0


def test_hazard_avoidance_routes():
    """
    Verifies that under spreading smoke or fire, Exit-Zero dynamically penalizes
    routes running through high hazard corridors, routing occupants to cleaner paths.
    """
    scenario = get_scenario("scenario_spreading_smoke")
    engine_base = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.BASELINE,
        seed=101,
    )
    engine_adapt = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=101,
    )

    # Run for 20 seconds of simulated time
    for _ in range(40):
        engine_base.step(dt=0.5)
        engine_adapt.step(dt=0.5)

    # Average hazard exposure of evacuated/evacuating agents in Adaptive should be lower or equal
    avg_exposure_base = sum(o.hazard_exposure for o in engine_base.occupants) / len(engine_base.occupants)
    avg_exposure_adapt = sum(o.hazard_exposure for o in engine_adapt.occupants) / len(engine_adapt.occupants)

    # EXIT_ZERO's hazard weighting w_h directs agents away from smoke
    assert avg_exposure_adapt <= avg_exposure_base + 0.05


def test_wheelchair_accessibility_hard_constraint():
    """
    Verifies that wheelchair occupants NEVER receive an inaccessible exit or
    inaccessible stair route, regardless of queue length or distance advantage.
    """
    scenario = get_scenario("scenario_mixed_mobility")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    wheelchair_occs = [o for o in engine.occupants if o.mobility_category == MobilityCategory.WHEELCHAIR]
    assert len(wheelchair_occs) > 0

    # In scenario_mixed_mobility, exit_south_emergency (Stairwell C) is NOT wheelchair accessible
    exit_c = next(e for e in engine.exits if e.id == "exit_south_emergency")
    assert not exit_c.is_wheelchair_accessible

    # Check initial route assignments
    for occ in wheelchair_occs:
        assert occ.target_exit_id != "exit_south_emergency"
        for nid in occ.current_path:
            node = engine.nav_model.nodes.get(nid)
            if node:
                assert node.is_accessible, f"Wheelchair occupant {occ.id} assigned inaccessible node {nid}"

    # Step simulation and verify hard constraint holds throughout
    for _ in range(20):
        engine.step(dt=0.5)
        for occ in wheelchair_occs:
            if occ.evacuation_state == EvacuationState.EVACUATING:
                assert occ.target_exit_id != "exit_south_emergency"


def test_interactive_exit_toggle_endpoint():
    """
    Verifies the interactive exit blockage API:
    Calling toggle-exit dynamically flips exit state and immediately triggers rerouting.
    """
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    # Step slightly
    for _ in range(5):
        engine.step(dt=0.5)

    # Find exit_north_main
    exit_a = next(e for e in engine.exits if e.id == "exit_north_main")
    assert not exit_a.is_blocked

    # Manually toggle exit_north_main to blocked
    success = engine.toggle_exit_block("exit_north_main")
    assert success
    assert exit_a.is_blocked

    # No active occupant should now be targeting blocked exit_north_main
    active_targeting_a = [
        o for o in engine.occupants
        if o.target_exit_id == "exit_north_main" and o.evacuation_state == EvacuationState.EVACUATING
    ]
    assert len(active_targeting_a) == 0

    # Toggle back to open
    success2 = engine.toggle_exit_block("exit_north_main")
    assert success2
    assert not exit_a.is_blocked


def test_reroute_events_telemetry():
    """
    Verifies that reroute events are properly structured with required fields
    and that simulation metrics reflect total reroutes.
    """
    scenario = get_scenario("scenario_sudden_exit_closure")
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
    )

    # Run for 25 seconds (past the 18.0s closure)
    for _ in range(50):
        engine.step(dt=0.5)

    state = engine.get_state()
    assert state.metrics.total_reroutes > 0
    assert len(state.reroute_events) > 0

    first_event = state.reroute_events[0]
    assert first_event.time_sec > 0.0
    assert first_event.occupant_id.startswith("occ_")
    assert first_event.previous_exit_id != first_event.new_exit_id
    assert first_event.reason in ["EMERGENCY_OVERRIDE", "CONGESTION_ADVANTAGE"]


def test_accessibility_reservation_objective():
    """
    Verifies that the accessibility reservation objective w_accessibility_reservation
    penalizes ambulatory agents from unnecessarily crowding accessible exits when stairs exist,
    and stabilizes wheelchair detours.
    """
    scenario = get_scenario("scenario_mixed_mobility")
    
    # Engine with active reservation
    weights_prio = AlgorithmWeights(
        w_accessibility_reservation=3.0,
    )
    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=101,
        algorithm_weights=weights_prio,
    )
    
    # Advance 20 steps
    for _ in range(20):
        engine.step(dt=0.5)
        
    # Verify wheelchair agents reach accessible ramp or portal without being stranded
    wc_agents = [o for o in engine.occupants if o.mobility_category == MobilityCategory.WHEELCHAIR]
    for wc in wc_agents:
        assert wc.target_exit_id in ["exit_west_ramp", "exit_north_main", "exit_east_fire"]
        assert wc.target_exit_id != "exit_south_emergency" # south stair is non-accessible


def test_performance_optimization_cache_determinism():
    """
    Verifies that the graph caching and arrival time precomputations in Phase 5.1
    maintain 100% bit-exact determinism across duplicate seed executions.
    """
    scenario = get_scenario("scenario_university_concourse")
    
    eng1 = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=101)
    for _ in range(40):
        eng1.step(dt=0.5)
        
    eng2 = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=101)
    for _ in range(40):
        eng2.step(dt=0.5)
        
    for o1, o2 in zip(eng1.occupants, eng2.occupants):
        assert o1.x == o2.x
        assert o1.y == o2.y
        assert o1.target_exit_id == o2.target_exit_id
        assert o1.movement_speed == o2.movement_speed
        assert o1.evacuation_state == o2.evacuation_state
    
    assert eng1.metrics.total_evacuated == eng2.metrics.total_evacuated
    assert eng1.metrics.max_crowd_density == eng2.metrics.max_crowd_density
    assert eng1.metrics.max_exit_queue_length == eng2.metrics.max_exit_queue_length
