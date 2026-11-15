import copy
import math
import pytest
import networkx as nx

from app.models.building import (
    Building,
    Doorway,
    Exit,
    Floor,
    Obstacle,
    ObstacleType,
    Room,
    Stairwell,
    BoundingBox,
    RoomType,
    HazardSource,
    HazardType,
    SpawnZone,
)
from app.models.occupant import EvacuationState, MobilityCategory, Occupant
from app.models.scenario import AlgorithmType, AlgorithmWeights, ScenarioConfig
from app.simulation.engine import SimulationEngine
from app.simulation.graph_generator import (
    BuildingGraphGenerator,
    extract_solid_wall_segments,
    edge_intersects_any_wall,
    segments_intersect,
)
from app.simulation.scenarios import (
    build_hq_scenario,
    build_multifloor_demo_scenario,
    build_university_hall_scenario,
    get_scenario,
)


def test_1_agent_cannot_cross_solid_wall():
    """Test 1: Ensures navigation graph edges and agent paths NEVER intersect solid room walls."""
    sc = build_multifloor_demo_scenario()
    gen = BuildingGraphGenerator()
    G, nav = gen.generate_building_graph(sc.building)

    wall_map = {
        f.id: extract_solid_wall_segments(f.rooms, f.doorways, f.obstacles)
        for f in sc.building.floors
    }

    # Verify no edge on any floor intersects solid wall partitions
    intersecting_edges = []
    for e in nav.edges:
        u = nav.nodes[e.u]
        v = nav.nodes[e.v]
        if u.floor_id == v.floor_id:
            walls = wall_map[u.floor_id]
            if edge_intersects_any_wall((u.x, u.y), (v.x, v.y), walls):
                intersecting_edges.append((e.u, e.v))

    assert len(intersecting_edges) == 0, f"Found intersecting edges: {intersecting_edges}"


def test_2_agent_passes_through_valid_doorway():
    """Test 2: Verifies occupants inside a room egress strictly through that room's open doorway."""
    sc = build_multifloor_demo_scenario()
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Pick an occupant spawning in room R-302 on floor 3
    occ_302 = next((o for o in engine.occupants if o.floor_id == "floor_3" and 21.0 <= o.x <= 33.0 and 5.0 <= o.y <= 15.0), None)
    assert occ_302 is not None

    # The occupant's path must start with node_room_R-302, then node_door_D-302
    assert len(occ_302.current_path) >= 2
    assert occ_302.current_path[0] == "node_room_R-302"
    assert occ_302.current_path[1] == "node_door_D-302"


def test_3_closed_door_prevents_passage():
    """Test 3: A closed doorway (is_open=False) acts as a solid wall and prevents passage."""
    sc = build_multifloor_demo_scenario()
    f3 = next(f for f in sc.building.floors if f.id == "floor_3")

    # Close door D-301
    d301 = next(d for d in f3.doorways if d.id == "D-301")
    d301.is_open = False

    gen = BuildingGraphGenerator()
    G, nav = gen.generate_floor_graph(f3)

    # Room R-301 should now be disconnected from the corridor
    r301_node = "node_room_R-301"
    assert G.degree(r301_node) == 0, "Room R-301 should have degree 0 when its only door is closed"


def test_4_new_wall_invalidates_intersecting_routes():
    """Test 4: Adding a new solid wall partition in the corridor invalidates intersecting edges."""
    sc = build_multifloor_demo_scenario()
    f3 = next(f for f in sc.building.floors if f.id == "floor_3")

    # Add a wall completely blocking the corridor at x=30.0 across y in [15.0, 30.0]
    new_wall = Obstacle(
        id="partition_wall_30",
        floor_id="floor_3",
        x=30.0,
        y=15.0,
        width=0.4,
        height=15.0,
        obstacle_type=ObstacleType.WALL,
        passable=False,
    )
    f3.obstacles.append(new_wall)

    gen = BuildingGraphGenerator()
    G, nav = gen.generate_floor_graph(f3)

    # An edge between spine nodes spanning x < 30 and x > 30 must not exist
    for u, v in G.edges():
        u_node = nav.nodes[u]
        v_node = nav.nodes[v]
        assert not (
            (u_node.x < 30.0 and v_node.x > 30.0 and 15.0 <= u_node.y <= 30.0 and 15.0 <= v_node.y <= 30.0)
            or (u_node.x > 30.0 and v_node.x < 30.0 and 15.0 <= u_node.y <= 30.0 and 15.0 <= v_node.y <= 30.0)
        ), f"Found edge crossing partition wall: {u} -> {v}"


def test_5_new_door_updates_connectivity():
    """Test 5: Adding a new doorway punches an aperture and creates new graph connectivity."""
    sc = build_multifloor_demo_scenario()
    f3 = next(f for f in sc.building.floors if f.id == "floor_3")

    # Add a communicating doorway between R-301 and R-302 on the partition at x=20.0, y=10.0
    comm_door = Doorway(
        id="D-COMM-301-302",
        floor_id="floor_3",
        x=20.0,
        y=10.0,
        width=1.2,
        connects_rooms=["R-301", "R-302"],
        is_open=True,
    )
    f3.doorways.append(comm_door)

    gen = BuildingGraphGenerator()
    G, nav = gen.generate_floor_graph(f3)

    assert "node_door_D-COMM-301-302" in nav.nodes
    # Check that R-301 can now reach R-302 through the communicating door
    path = nx.shortest_path(G, "node_room_R-301", "node_room_R-302")
    assert "node_door_D-COMM-301-302" in path


def test_6_fire_blocks_previously_valid_route():
    """Test 6: Spreading fire renders the corridor impassable, updating edge hazard and impassability."""
    sc = build_multifloor_demo_scenario()
    # Place fire directly in the central corridor on Floor 3
    sc.hazard_sources = [
        HazardSource(
            id="fire_floor3_atrium",
            floor_id="floor_3",
            x=40.0,
            y=22.5,
            hazard_type=HazardType.FIRE,
            start_time_sec=0.0,
            growth_rate=0.4,
            max_radius=10.0,
            intensity=1.0,
        )
    ]
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Advance simulation by 5 seconds
    for _ in range(10):
        engine.step(dt=0.5)

    # Check edges near (40, 22.5) are marked impassable
    impassable_edges = [e for e in engine.nav_model.edges if getattr(e, "is_impassable", False)]
    assert len(impassable_edges) > 0


def test_7_emergency_replanning_selects_feasible_alternative():
    """Test 7: When an emergency blocks an exit, occupants immediately replan to a safe reachable exit."""
    sc = get_scenario("scenario_sudden_exit_closure")
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Verify exit_east_fire starts open
    exit_east = next(e for e in engine.exits if e.id == "exit_east_fire")
    assert not exit_east.is_blocked

    # Manually trigger block_exit on exit_east_fire
    success = engine.toggle_exit_block("exit_east_fire")
    assert success is True
    assert exit_east.is_blocked is True

    # Step simulation
    engine.step(dt=0.5)

    # No active evacuating occupant should now target exit_east_fire
    targeting_east = [
        o for o in engine.occupants
        if o.target_exit_id == "exit_east_fire" and o.evacuation_state == EvacuationState.EVACUATING
    ]
    assert len(targeting_east) == 0


def test_8_no_feasible_route_produces_trapped_state():
    """Test 8: Occupants with no reachable open exit enter TRAPPED state without teleporting."""
    sc = build_multifloor_demo_scenario()
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Block all exits
    for e in engine.exits:
        e.is_blocked = True

    engine._invalidate_graph_cache()
    engine._check_replanning_triggers(force_emergency=True)

    # Step simulation
    engine.step(dt=0.5)

    # Occupants should be marked TRAPPED
    trapped = [o for o in engine.occupants if o.evacuation_state == EvacuationState.TRAPPED]
    assert len(trapped) > 0


def test_9_agent_cannot_pass_through_floor_slabs():
    """Test 9: Agent vertical elevation z stays continuous and matches floor elevations without clipping slabs."""
    sc = build_multifloor_demo_scenario()
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Step simulation for 20 seconds
    for _ in range(40):
        engine.step(dt=0.5)
        for o in engine.occupants:
            if o.evacuation_state == EvacuationState.EVACUATING:
                # Z must be between ground (0.0) and roof (6.4m) + tolerance
                assert 0.0 <= o.z <= 6.5, f"Occupant {o.id} clipped slab at z={o.z}"


def test_10_stair_traversal_follows_valid_geometry():
    """Test 10: Stairwell vertical edges connect landing_from to landing_to with valid transit length."""
    sc = build_multifloor_demo_scenario()
    gen = BuildingGraphGenerator()
    G, nav = gen.generate_building_graph(sc.building)

    stair_edges = [
        e for e in nav.edges
        if "vertical" in e.u or "vertical" in e.v
    ]
    assert len(stair_edges) > 0

    for e in stair_edges:
        assert e.length > 0
        assert e.base_weight > 0
        u_node = nav.nodes[e.u]
        v_node = nav.nodes[e.v]
        assert u_node.floor_id is not None
        assert v_node.floor_id is not None


def test_11_wheelchair_routes_respect_accessibility():
    """Test 11: Wheelchair occupants strictly follow wheelchair accessible routes and ramps, never stairs."""
    sc = build_multifloor_demo_scenario()
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    wc_occupants = [o for o in engine.occupants if o.mobility_category == MobilityCategory.WHEELCHAIR]
    assert len(wc_occupants) > 0

    # Step simulation for 30 steps
    for _ in range(30):
        engine.step(dt=0.5)
        for o in wc_occupants:
            if o.current_path and o.path_index < len(o.current_path):
                # Verify no node in wheelchair path is a non-accessible stair
                for nid in o.current_path:
                    node = engine.nav_model.nodes.get(nid)
                    if node:
                        assert node.is_accessible, f"Wheelchair occupant {o.id} routed through inaccessible node {nid}"


def test_12_building_edits_trigger_navigation_validation():
    """Test 12: Updating building structure triggers validate_graph and returns updated audit metrics."""
    sc = build_multifloor_demo_scenario()
    gen = BuildingGraphGenerator()
    G1, nav1 = gen.generate_building_graph(sc.building)
    audit1 = gen.validate_graph(G1, nav1)

    assert audit1["is_valid"] is True
    assert len(audit1["unreachable_rooms"]) == 0

    # Add 2 new rooms without doors to test validation detection
    f1 = sc.building.floors[0]
    f1.rooms.append(Room(id="R-SEALED-1", floor_id="floor_1", name="Sealed Vault", bounds=BoundingBox(x=70, y=30, width=5, height=5)))
    G2, nav2 = gen.generate_building_graph(sc.building)
    audit2 = gen.validate_graph(G2, nav2)

    assert audit2["is_valid"] is False
    assert "node_room_R-SEALED-1" in audit2["unreachable_rooms"]


def test_13_deterministic_replay_with_fixed_inputs():
    """Test 13: Deterministic replay with identical seed produces bitwise identical trajectories and metrics."""
    sc = build_multifloor_demo_scenario()
    engine1 = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=999)
    engine2 = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=999)

    for _ in range(20):
        s1 = engine1.step(dt=0.5)
        s2 = engine2.step(dt=0.5)

    assert s1.current_time_sec == s2.current_time_sec
    assert s1.metrics.total_evacuated == s2.metrics.total_evacuated
    for o1, o2 in zip(engine1.occupants, engine2.occupants):
        assert o1.x == o2.x
        assert o1.y == o2.y
        assert o1.z == o2.z
        assert o1.target_exit_id == o2.target_exit_id


def test_14_existing_benchmark_scenarios_remain_functional():
    """Test 14: All existing core scenarios (HQ, University, Multifloor) generate valid graphs and run."""
    scenarios = [
        build_hq_scenario(),
        build_university_hall_scenario(),
        build_multifloor_demo_scenario(),
    ]
    gen = BuildingGraphGenerator()

    for sc in scenarios:
        G, nav = gen.generate_building_graph(sc.building)
        audit = gen.validate_graph(G, nav)
        assert audit["is_valid"] is True, f"Scenario {sc.id} failed validation: {audit}"
        assert audit["total_nodes"] > 10
        assert audit["total_edges"] > 10

        # Step simulation
        eng = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)
        state = eng.step(dt=0.5)
        assert state.status.value in ["running", "completed"]
