"""
Focused regression tests for graph caching, cache invalidation, and routing correctness.

Covers the 5 required regression scenarios for Phase 5.2:
1. Exit closed -> cache invalidated -> paths exclude exit.
2. Exit reopened -> cache invalidated -> paths restore exit.
3. Corridor blocked -> cache invalidated -> paths route around corridor.
4. Hazard reaches >= 0.85 -> cache invalidated -> corridor excluded from routes.
5. Optimized single-source Dijkstra paths match uncached reference paths bit-for-bit.
"""

import math
import networkx as nx
import pytest
from app.models.building import HazardSource
from app.models.occupant import EvacuationState, MobilityCategory
from app.models.scenario import AlgorithmType, ScenarioEvent, ScenarioEventType
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import get_scenario


def test_exit_closed_invalidates_cache_and_excludes_exit():
    """Test 1: Exit closed -> cache invalidated -> paths exclude exit."""
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Prime cache by routing
    G_before = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert len(engine._cached_graphs) > 0
    assert G_before.has_node("node_exit_exit_north_main")
    assert G_before.degree("node_exit_exit_north_main") > 0

    # Spy on _invalidate_graph_cache
    invalidation_called = False
    original_invalidate = engine._invalidate_graph_cache

    def wrap_invalidate():
        nonlocal invalidation_called
        invalidation_called = True
        original_invalidate()

    engine._invalidate_graph_cache = wrap_invalidate

    # Block north main exit
    ok = engine.toggle_exit_block("exit_north_main")
    assert ok is True
    assert invalidation_called is True

    # Advance one tick
    engine.step(dt=0.5)

    # Re-fetch graph; blocked exit node should be excluded or isolated (degree 0)
    G_after = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert not G_after.has_node("node_exit_exit_north_main") or G_after.degree("node_exit_exit_north_main") == 0

    # No active occupant should target the closed exit
    active_targeting = [
        o for o in engine.occupants
        if o.evacuation_state == EvacuationState.EVACUATING and o.target_exit_id == "exit_north_main"
    ]
    assert len(active_targeting) == 0


def test_exit_reopened_invalidates_cache_and_restores_exit():
    """Test 2: Exit reopened -> cache invalidated -> paths restore exit."""
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Block north exit
    engine.toggle_exit_block("exit_north_main")
    engine.step(dt=0.5)
    G_blocked = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert not G_blocked.has_node("node_exit_exit_north_main") or G_blocked.degree("node_exit_exit_north_main") == 0

    # Spy on cache invalidation
    invalidation_called = False
    original_invalidate = engine._invalidate_graph_cache

    def wrap_invalidate():
        nonlocal invalidation_called
        invalidation_called = True
        original_invalidate()

    engine._invalidate_graph_cache = wrap_invalidate

    # Reopen north exit
    ok = engine.toggle_exit_block("exit_north_main")
    assert ok is True
    assert invalidation_called is True

    # Check graph restores traversable edge to north exit
    G_restored = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert G_restored.has_node("node_exit_exit_north_main")
    assert G_restored.degree("node_exit_exit_north_main") > 0

    north_exit = next(e for e in engine.exits if e.id == "exit_north_main")
    assert not north_exit.is_blocked


def test_corridor_blocked_invalidates_cache_and_reroutes():
    """Test 3: Corridor blocked -> cache invalidated -> paths route around corridor."""
    scenario = get_scenario("scenario_hq_floor1")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Advance 1 step to establish paths
    engine.step(dt=0.5)
    assert len(engine._cached_graphs) > 0

    # Pick an active occupant with a path of at least 3 nodes
    occ = next(o for o in engine.occupants if o.current_path and len(o.current_path) >= 3)
    u = occ.current_path[1]
    v = occ.current_path[2]

    # Block this corridor via scheduled event execution
    block_event = ScenarioEvent(
        time_sec=engine.current_time_sec,
        event_type=ScenarioEventType.BLOCK_CORRIDOR,
        target_id=u,
        secondary_target_id=v,
        description="Structural beam collapse",
    )
    engine.events.append(block_event)
    emergency = engine._execute_scheduled_scenario_events()
    assert emergency is True

    # Cache must be wiped
    assert len(engine._cached_graphs) == 0

    # Check that (u, v) is marked is_blocked
    assert engine._edge_data[(u, v)]["is_blocked"] is True

    # Traversable graph must not contain (u, v)
    G_new = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert not G_new.has_edge(u, v)

    # Force replanning
    engine._check_replanning_triggers(force_emergency=True)
    if occ.current_path and occ.evacuation_state == EvacuationState.EVACUATING:
        # The occupant's upcoming path segments must not traverse (u, v)
        path_edges = set(zip(occ.current_path[:-1], occ.current_path[1:]))
        assert (u, v) not in path_edges and (v, u) not in path_edges


def test_hazard_reaches_critical_invalidates_cache_and_excludes_corridor():
    """Test 4: Hazard reaches >= 0.85 -> cache invalidated -> corridor excluded from routes."""
    scenario = get_scenario("scenario_spreading_smoke")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step until cache is populated
    engine.step(dt=0.5)
    assert len(engine._cached_graphs) > 0

    # Pick an edge and position a high-intensity hazard directly over its midpoint
    edge = engine.nav_model.edges[0]
    u_node = engine.nav_model.nodes[edge.u]
    v_node = engine.nav_model.nodes[edge.v]
    mx = (u_node.x + v_node.x) / 2.0
    my = (u_node.y + v_node.y) / 2.0

    # Advance hazard to engulf edge with intensity 1.0
    critical_hazard = HazardSource(
        id="test_crit_fire",
        floor_id=u_node.floor_id,
        x=mx,
        y=my,
        radius=5.0,
        intensity=1.0,
        growth_rate=2.0,
        max_radius=20.0,
        start_time_sec=engine.current_time_sec,
    )
    engine.hazards.append(critical_hazard)

    # Step simulation to trigger _update_hazards_and_corridors
    engine.step(dt=0.5)

    # Verify edge is marked impassable
    info = engine._edge_data.get((edge.u, edge.v))
    assert info is not None
    assert info["is_impassable"] is True

    # Verify the cached graph no longer includes this engulfed edge
    G_active = engine._get_cached_graph(MobilityCategory.STANDARD)
    assert not G_active.has_edge(edge.u, edge.v)


def test_optimized_single_source_dijkstra_matches_uncached_reference():
    """
    Test 5: Optimized single-source Dijkstra paths match uncached reference
    Dijkstra paths bit-for-bit across identical simulation states.
    """
    scenario = get_scenario("scenario_university_concourse")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.BASELINE, seed=101)

    # Advance 10 steps to create varied positions
    for _ in range(10):
        engine.step(dt=0.5)

    # For each mobility category, compare cached subgraph with fresh uncached build
    for mobility in [MobilityCategory.STANDARD, MobilityCategory.WHEELCHAIR]:
        cached_G = engine._get_cached_graph(mobility)
        uncached_G = engine._build_traversable_graph(mobility)

        # Graph topologies must be identical
        assert set(cached_G.nodes()) == set(uncached_G.nodes())
        assert set(cached_G.edges()) == set(uncached_G.edges())

        # For every node, single_source_dijkstra must produce identical path lengths and paths
        for n in cached_G.nodes():
            cached_paths = nx.single_source_dijkstra_path(cached_G, n, weight="weight")
            cached_dists = nx.single_source_dijkstra_path_length(cached_G, n, weight="weight")

            uncached_paths = nx.single_source_dijkstra_path(uncached_G, n, weight="weight")
            uncached_dists = nx.single_source_dijkstra_path_length(uncached_G, n, weight="weight")

            assert cached_dists == uncached_dists
            assert cached_paths == uncached_paths
