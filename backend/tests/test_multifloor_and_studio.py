import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.building import Building, Floor, Room, Doorway, Exit, Stairwell, BoundingBox, RoomType
from app.models.scenario import AlgorithmType
from app.simulation.engine import SimulationEngine
from app.simulation.graph_generator import BuildingGraphGenerator
from app.simulation.scenarios import get_scenario


client = TestClient(app)


def test_multifloor_demo_scenario_structure():
    """Validates the multi-floor acceptance scenario geometry."""
    sc = get_scenario("scenario_multifloor_demo")
    assert len(sc.building.floors) == 3
    assert sc.total_occupants == 140

    f1 = sc.building.floors[0]
    f2 = sc.building.floors[1]
    f3 = sc.building.floors[2]

    assert f1.elevation == 0.0
    assert f2.elevation == 3.2
    assert f3.elevation == 6.4

    total_rooms = len(f1.rooms) + len(f2.rooms) + len(f3.rooms)
    assert total_rooms == 28

    total_exits = len(f1.exits) + len(f2.exits) + len(f3.exits)
    assert total_exits == 4


def test_multifloor_graph_generation_and_connectivity():
    """Ensures 3D graph generator links all floors via stairs and ramps."""
    sc = get_scenario("scenario_multifloor_demo")
    gen = BuildingGraphGenerator(waypoint_spacing=4.0)

    G, nav_model = gen.generate_building_graph(sc.building)
    assert G.number_of_nodes() > 100
    assert G.number_of_edges() > 100

    # Ensure nodes have floor elevations
    z_coords = {n.z for n in nav_model.nodes.values()}
    assert 0.0 in z_coords
    assert 3.2 in z_coords
    assert 6.4 in z_coords

    # Audit graph validity
    audit = gen.validate_graph(G, nav_model)
    assert audit["is_valid"] is True
    assert len(audit["unreachable_rooms"]) == 0
    assert audit["wheelchair_accessible_coverage_percent"] == 100.0


def test_wheelchair_ramp_routing_versus_stairs():
    """Verifies wheelchair users strictly use ramps rather than stairs."""
    sc = get_scenario("scenario_multifloor_demo")
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    wheelchair_agents = [o for o in engine.occupants if o.mobility_category.value == "wheelchair"]
    standard_agents = [o for o in engine.occupants if o.mobility_category.value == "standard"]

    assert len(wheelchair_agents) > 0
    assert len(standard_agents) > 0

    # Step simulation
    for _ in range(30):
        engine.step(dt=0.5)

    # Check wheelchair paths do not contain stair edges
    for occ in wheelchair_agents:
        for nid in occ.current_path:
            node = engine.nav_model.nodes.get(nid)
            if node and node.node_type.value == "stairwell":
                # Must be accessible (i.e. a ramp)
                assert node.is_accessible is True


def test_building_studio_endpoints_crud_and_validation():
    """Tests the Building Studio API endpoints."""
    # 1. List buildings
    resp = client.get("/api/buildings")
    assert resp.status_code == 200
    bldgs = resp.json()
    assert len(bldgs) > 0
    assert any(b["name"] == "EXIT-ZERO Multi-Floor Demo" for b in bldgs)

    # 2. Get building detail
    demo_id = next(b["id"] for b in bldgs if b["name"] == "EXIT-ZERO Multi-Floor Demo")
    resp_detail = client.get(f"/api/buildings/{demo_id}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert len(detail["floors"]) == 3

    # 3. Create a custom building
    test_custom_building = {
        "id": "bldg_test_studio_custom",
        "name": "Test Innovation Tower",
        "description": "Studio created building for verification",
        "floors": [
            {
                "id": "f_custom_1",
                "name": "Level 1",
                "level": 1,
                "elevation": 0.0,
                "floor_height": 3.2,
                "width": 60.0,
                "height": 40.0,
                "rooms": [
                    {
                        "id": "r_1",
                        "floor_id": "f_custom_1",
                        "name": "Lab A",
                        "bounds": {"x": 5.0, "y": 5.0, "width": 15.0, "height": 10.0},
                        "room_type": "lab",
                        "max_capacity": 20,
                    }
                ],
                "doorways": [
                    {"id": "d_1", "floor_id": "f_custom_1", "x": 12.0, "y": 15.0, "width": 1.2, "connects_rooms": ["r_1"], "is_open": True, "is_emergency_exit": False}
                ],
                "obstacles": [],
                "exits": [
                    {"id": "ex_1", "floor_id": "f_custom_1", "name": "Main Gate", "x": 30.0, "y": 2.0, "width": 2.4, "throughput_per_sec": 2.5, "is_wheelchair_accessible": True, "is_blocked": False}
                ],
                "stairwells": []
            }
        ]
    }

    create_resp = client.post("/api/buildings", json=test_custom_building)
    assert create_resp.status_code == 200
    assert create_resp.json()["id"] == "bldg_test_studio_custom"

    # 4. Validate custom building
    val_resp = client.post("/api/buildings/validate", json=test_custom_building)
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["is_valid"] is True
    assert val_data["stats"]["rooms"] == 1
    assert val_data["stats"]["exits"] == 1

    # 5. Run simulation on custom building
    run_resp = client.post("/api/buildings/bldg_test_studio_custom/run", json={"occupant_count": 10, "algorithm": "adaptive"})
    assert run_resp.status_code == 200
    run_state = run_resp.json()
    assert run_state["status"] == "idle" or run_state["status"] == "running"
    assert len(run_state["occupants"]) == 10

    # 6. Delete custom building cleanup
    del_resp = client.delete("/api/buildings/bldg_test_studio_custom")
    assert del_resp.status_code == 200


def test_continuous_multifloor_descent_and_elevation_tracking():
    """
    Verifies that agents starting on upper floors (Floor 3) genuinely
    traverse intermediate floors (Floor 2) to reach ground exits (Floor 1),
    and that vertical elevations (z) and floor_ids update continuously without teleportation.
    """
    sc = get_scenario("scenario_multifloor_demo")
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    # Initial state: occupants exist across all 3 floors
    floor_3_occs = [o for o in engine.occupants if o.floor_id == "floor_3"]
    assert len(floor_3_occs) > 0
    initial_z = {o.id: o.z for o in floor_3_occs}
    assert all(z == 6.4 for z in initial_z.values())

    # Step through simulation and record continuous z transitions
    intermediate_z_observed = False
    reached_floor_2 = False
    reached_floor_1 = False

    for step_num in range(80):  # 40 seconds of simulation
        engine.step(dt=0.5)

        for occ_id in initial_z.keys():
            occ = next(o for o in engine.occupants if o.id == occ_id)

            # Check for smooth continuous elevation along stairs/ramps
            if 0.0 < occ.z < 6.4 and occ.z != 3.2:
                intermediate_z_observed = True

            if occ.floor_id == "floor_2":
                reached_floor_2 = True
            elif occ.floor_id == "floor_1":
                reached_floor_1 = True

    # Confirm genuine continuous vertical transition across levels
    assert intermediate_z_observed, "Agents must smoothly interpolate z along stairwell/ramp edges"
    assert reached_floor_2, "Agents from Floor 3 must transition through Floor 2"
    assert reached_floor_1, "Agents must ultimately descend to Floor 1 egress corridors"


def test_multifloor_all_floors_simulated_simultaneously():
    """
    Verifies that the simulation engine processes crowd physics and agent
    movement across all active floors simultaneously, not merely on a single active floor.
    """
    sc = get_scenario("scenario_multifloor_demo")
    engine = SimulationEngine(sc, algorithm=AlgorithmType.ADAPTIVE, seed=42)

    initial_pos = {o.id: (o.x, o.y, o.z) for o in engine.occupants}

    # Step simulation 5 times
    for _ in range(5):
        engine.step(dt=0.5)

    # Check movement across each distinct floor
    f1_moved = any(
        (o.x, o.y, o.z) != initial_pos[o.id]
        for o in engine.occupants
        if o.floor_id == "floor_1"
    )
    f2_moved = any(
        (o.x, o.y, o.z) != initial_pos[o.id]
        for o in engine.occupants
        if o.floor_id == "floor_2"
    )
    f3_moved = any(
        (o.x, o.y, o.z) != initial_pos[o.id]
        for o in engine.occupants
        if o.floor_id == "floor_3"
    )

    assert f1_moved, "Floor 1 agents must simulate and move"
    assert f2_moved, "Floor 2 agents must simulate and move"
    assert f3_moved, "Floor 3 agents must simulate and move simultaneously"

