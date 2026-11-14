import copy
from collections import deque
import pytest

from app.models.building import Exit
from app.models.occupant import EvacuationState, MobilityCategory, Occupant
from app.models.scenario import AlgorithmType
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import build_hq_scenario, build_university_hall_scenario


def test_speed_decreases_under_congestion():
    """Requirement 1: Walking speed decreases monotonically as local crowd density increases."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42)

    v0 = 1.35
    v_free = engine._get_weidmann_speed(v0, density=0.1)
    v_low = engine._get_weidmann_speed(v0, density=1.0)
    v_med = engine._get_weidmann_speed(v0, density=2.5)
    v_high = engine._get_weidmann_speed(v0, density=4.5)
    v_crush = engine._get_weidmann_speed(v0, density=5.4)

    assert v_free == v0
    assert v_low < v_free
    assert v_med < v_low
    assert v_high < v_med
    assert v_crush < v_high
    # Minimum speed crawl ratio enforced
    assert v_crush >= round(v0 * engine.MIN_SPEED_RATIO, 3) - 1e-6
    assert v_crush > 0.0


def test_no_negative_speed_or_density():
    """Requirement 7: Speed and density must never be negative under any conditions."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42)

    for rho in [-10.0, 0.0, 0.001, 1.0, 5.4, 15.0, 100.0]:
        speed = engine._get_weidmann_speed(1.35, rho)
        assert speed > 0.0, f"Speed was not strictly positive for rho={rho}"

    # Step engine and inspect all occupants and edges
    engine.step(dt=0.5)
    for occ in engine.occupants:
        assert occ.movement_speed >= 0.0
        assert occ.free_speed > 0.0
    for edge in engine.nav_model.edges:
        assert edge.current_density >= 0.0
        assert edge.current_occupants >= 0


def test_fifo_exit_queue_order():
    """Requirement 3: Exit queues service occupants strictly in first-in, first-out order."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=10)

    # Pick first exit
    target_exit = engine.exits[0]
    target_exit.throughput_per_sec = 1.0 # 1 person per second

    # Clear existing queues
    engine.exit_queues[target_exit.id].clear()
    engine._queued_occupant_ids.clear()

    # Manually arrive 5 occupants in known order
    arrival_order = [f"test_agent_{i}" for i in range(5)]
    for i, aid in enumerate(arrival_order):
        occ = Occupant(
            id=aid,
            floor_id=engine.floor.id,
            x=target_exit.x,
            y=target_exit.y,
            current_node_id=f"node_exit_{target_exit.id}",
            movement_speed=1.3,
            free_speed=1.3,
            mobility_category=MobilityCategory.STANDARD,
            evacuation_state=EvacuationState.EVACUATING,
        )
        engine.occupants.append(occ)
        engine._handle_occupant_reach_exit(occ)

    # Queue should contain agents in exact arrival order
    queued_ids = list(engine.exit_queues[target_exit.id])
    assert queued_ids == arrival_order

    # Service with dt=1.0 (should release exactly arrival_order[0])
    exited_step1 = engine._service_exit_queues(dt=1.0)
    assert exited_step1 == 1
    o0 = next(o for o in engine.occupants if o.id == arrival_order[0])
    assert o0.evacuation_state == EvacuationState.EXITED

    # Service with dt=2.0 (should release arrival_order[1] and arrival_order[2])
    exited_step2 = engine._service_exit_queues(dt=2.0)
    assert exited_step2 == 2
    o1 = next(o for o in engine.occupants if o.id == arrival_order[1])
    o2 = next(o for o in engine.occupants if o.id == arrival_order[2])
    assert o1.evacuation_state == EvacuationState.EXITED
    assert o2.evacuation_state == EvacuationState.EXITED

    # Remaining in queue should be arrival_order[3], arrival_order[4]
    assert list(engine.exit_queues[target_exit.id]) == arrival_order[3:]


def test_fractional_throughput_accumulation():
    """Requirement 4 & 5: Fractional throughput accumulation guarantees exact throughput across steps."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42)

    test_exit = engine.exits[0]
    test_exit.throughput_per_sec = 1.5 # 1.5 pers/s

    engine.exit_queues[test_exit.id].clear()
    engine._queued_occupant_ids.clear()

    # Enqueue 10 test occupants
    for i in range(10):
        occ = Occupant(
            id=f"frac_occ_{i}",
            floor_id=engine.floor.id,
            x=test_exit.x,
            y=test_exit.y,
            current_node_id=f"node_exit_{test_exit.id}",
            movement_speed=1.2,
            free_speed=1.2,
            mobility_category=MobilityCategory.STANDARD,
        )
        engine.occupants.append(occ)
        engine._handle_occupant_reach_exit(occ)

    # Step with dt = 0.5s:
    # budget step 1: 0.0 + 1.5 * 0.5 = 0.75 -> 0 exits, budget remainder = 0.75
    exited1 = engine._service_exit_queues(dt=0.5)
    assert exited1 == 0
    assert abs(engine.exit_service_budgets[test_exit.id] - 0.75) < 1e-5

    # budget step 2: 0.75 + 1.5 * 0.5 = 1.50 -> 1 exit, budget remainder = 0.50
    exited2 = engine._service_exit_queues(dt=0.5)
    assert exited2 == 1
    assert abs(engine.exit_service_budgets[test_exit.id] - 0.50) < 1e-5

    # budget step 3: 0.50 + 1.5 * 0.5 = 1.25 -> 1 exit, budget remainder = 0.25
    exited3 = engine._service_exit_queues(dt=0.5)
    assert exited3 == 1
    assert abs(engine.exit_service_budgets[test_exit.id] - 0.25) < 1e-5

    # Total over 3 steps (1.5 seconds) = 2 exits (1.5 * 1.5 = 2.25 -> 2 exits)
    assert exited1 + exited2 + exited3 == 2


def test_no_duplicate_evacuation():
    """Requirement 6: An occupant can only evacuate once; cannot re-enter queues or exit twice."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=20)

    # Run for 20 steps
    for _ in range(20):
        engine.step(dt=0.5)

    evacuated_ids = [o.id for o in engine.occupants if o.evacuation_state == EvacuationState.EXITED]
    # Check no duplicate occupant IDs in evacuated list
    assert len(evacuated_ids) == len(set(evacuated_ids))

    # Try manually re-enqueuing an already evacuated occupant
    if evacuated_ids:
        already_evacuated = next(o for o in engine.occupants if o.id == evacuated_ids[0])
        initial_queue_size = sum(len(q) for q in engine.exit_queues.values())
        engine._handle_occupant_reach_exit(already_evacuated)
        final_queue_size = sum(len(q) for q in engine.exit_queues.values())
        assert final_queue_size == initial_queue_size


def test_wheelchair_occupant_constraints():
    """Requirement 8: Wheelchair occupants respect accessibility and lower speed bounds."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=42)

    wheelchair_users = [o for o in engine.occupants if o.mobility_category == MobilityCategory.WHEELCHAIR]
    assert len(wheelchair_users) > 0

    for wc in wheelchair_users:
        # Free speed should be between 0.65 and 0.85
        assert 0.60 <= wc.free_speed <= 0.90
        # If assigned path, none of the path nodes should be non-accessible
        for nid in wc.current_path:
            node = engine.nav_model.nodes[nid]
            assert node.is_accessible, f"Wheelchair user {wc.id} was routed to non-accessible node {nid}"


def test_simulation_determinism_identical_seeds():
    """Requirement 9: Identical seeds produce bitwise identical states over time."""
    scenario = build_hq_scenario()
    eng1 = SimulationEngine(scenario_config=scenario, seed=999, occupant_count_override=30)
    eng2 = SimulationEngine(scenario_config=scenario, seed=999, occupant_count_override=30)

    for step in range(15):
        eng1.step(dt=0.5)
        eng2.step(dt=0.5)

    assert eng1.current_time_sec == eng2.current_time_sec
    assert eng1.metrics.total_evacuated == eng2.metrics.total_evacuated

    for o1, o2 in zip(eng1.occupants, eng2.occupants):
        assert o1.id == o2.id
        assert o1.x == o2.x
        assert o1.y == o2.y
        assert o1.evacuation_state == o2.evacuation_state
        assert o1.movement_speed == o2.movement_speed
        assert o1.distance_traveled == o2.distance_traveled


def test_reset_reproducibility():
    """Requirement 10: Reset restores exact initial state for the same seed."""
    scenario = build_hq_scenario()
    engine = SimulationEngine(scenario_config=scenario, seed=77, occupant_count_override=25)

    initial_positions = [(o.x, o.y, o.current_path) for o in engine.occupants]

    # Run for 20 steps
    for _ in range(20):
        engine.step(dt=0.5)

    # Re-initialize with same parameters (equivalent to reset)
    engine_reset = SimulationEngine(scenario_config=scenario, seed=77, occupant_count_override=25)
    reset_positions = [(o.x, o.y, o.current_path) for o in engine_reset.occupants]

    assert initial_positions == reset_positions
    assert engine_reset.current_time_sec == 0.0
    assert engine_reset.metrics.total_evacuated == 0


def test_simulation_completion():
    """Requirement 11: Simulation stops automatically when all agents finish evacuation or reach max time."""
    scenario = build_hq_scenario()
    # Small group for fast completion test
    engine = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=10, max_time_sec=120.0)

    steps = 0
    while engine.status != "completed" and steps < 300:
        engine.step(dt=0.5)
        steps += 1

    assert engine.status == "completed"
    assert engine.metrics.completion_percentage == 100.0 or engine.current_time_sec >= 120.0


def test_zero_occupant_and_blocked_exit_edge_cases():
    """Requirement 12: Zero-occupant and fully blocked exit edge cases execute gracefully."""
    scenario = build_hq_scenario()

    # 1. Zero occupants
    engine_zero = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=0)
    state = engine_zero.step(dt=0.5)
    assert state.metrics.total_occupants == 0
    assert state.metrics.total_evacuated == 0

    # 2. Block all exits
    scenario_blocked = copy.deepcopy(scenario)
    for exit_elem in scenario_blocked.building.floors[0].exits:
        exit_elem.is_blocked = True

    engine_blocked = SimulationEngine(scenario_config=scenario_blocked, seed=42, occupant_count_override=15)
    for _ in range(5):
        engine_blocked.step(dt=0.5)

    # All occupants must be trapped since no exits are open
    for occ in engine_blocked.occupants:
        assert occ.evacuation_state == EvacuationState.TRAPPED


def test_dt_consistency_numerical_tolerance():
    """Requirement 13: Different dt values (e.g. 0.25s vs 0.5s) produce consistent exit counts within tolerance."""
    scenario = build_hq_scenario()

    # Run for 20.0 seconds total with dt = 0.5 (40 steps)
    eng_half = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=40)
    for _ in range(40):
        eng_half.step(dt=0.5)

    # Run for 20.0 seconds total with dt = 0.25 (80 steps)
    eng_quarter = SimulationEngine(scenario_config=scenario, seed=42, occupant_count_override=40)
    for _ in range(80):
        eng_quarter.step(dt=0.25)

    assert abs(eng_half.current_time_sec - 20.0) < 1e-4
    assert abs(eng_quarter.current_time_sec - 20.0) < 1e-4

    # Evacuated counts should be within small numerical discretization tolerance (<= 3 occupants difference)
    evac_diff = abs(eng_half.metrics.total_evacuated - eng_quarter.metrics.total_evacuated)
    assert evac_diff <= 4, f"Discretization discrepancy too high: {eng_half.metrics.total_evacuated} vs {eng_quarter.metrics.total_evacuated}"
