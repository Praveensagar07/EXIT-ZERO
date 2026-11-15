"""Phase 5.6 Tests: bounds scaffold, structured JSON import,
vertical grounding, and multi-tier evacuation guidance.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.scenario import AlgorithmType
from app.simulation.engine import SimulationEngine
from app.simulation.graph_generator import BuildingGraphGenerator
from app.simulation.scenarios import get_scenario
from app.simulation.importer import import_gltf_or_cad_mesh, import_scenario_json
from app.simulation.guidance import generate_building_guidance, format_guidance_markdown

client = TestClient(app)


def test_import_gltf_mesh_to_building():
    """Verify bounds input produces a clearly labelled navigation scaffold."""
    mock_payload = {
        "name": "Research Wing B",
        "floors_count": 3,
        "bounds": {
            "min_x": -30.0,
            "max_x": 30.0,
            "min_y": -20.0,
            "max_y": 20.0,
            "min_z": 0.0,
            "max_z": 9.6,
        },
        "raw_payload": {
            "materials": ["concrete", "glass", "steel"],
            "mesh_count": 42,
        },
    }

    building = import_gltf_or_cad_mesh(mock_payload)
    assert building.name == "Research Wing B"
    assert len(building.floors) == 3
    assert "generated placeholders" in building.description
    assert "no geometry was extracted" in building.description
    assert building.author == "EXIT-ZERO Bounds Scaffold Generator"

    # Check elevations
    assert building.floors[0].elevation == 0.0
    assert building.floors[1].elevation == 3.2
    assert building.floors[2].elevation == 6.4

    # Check structural elements
    for fl in building.floors:
        assert len(fl.rooms) >= 4
        assert len(fl.doorways) >= 4

    # Check vertical circulation
    assert len(building.floors[0].exits) >= 2
    # Upper floors should have stairs / ramps
    assert len(building.floors[0].stairwells) >= 1

    # Verify building graph validity
    gen = BuildingGraphGenerator(waypoint_spacing=4.0)
    G, nav_model = gen.generate_building_graph(building)
    audit = gen.validate_graph(G, nav_model)
    assert audit["is_valid"] is True
    assert len(audit["unreachable_rooms"]) == 0


def test_import_scenario_json():
    """Verify normalization of external CAD/BIM JSON structure into EXIT-ZERO Building."""
    raw_data = {
        "name": "Standard Clinic",
        "floors": [
            {
                "id": "fl_ground",
                "name": "Ground Floor",
                "level": 0,
                "elevation": 0.0,
                "height": 3.0,
                "rooms": [
                    {
                        "id": "room_reception",
                        "name": "Reception",
                        "bounds": {"x": 0, "y": 0, "width": 10, "height": 10},
                        "type": "office",
                        "capacity": 20,
                    }
                ],
                "doors": [
                    {
                        "id": "door_1",
                        "position": {"x": 10.0, "y": 5.0},
                        "connects": ["room_reception"],
                    }
                ],
                "exits": [
                    {
                        "id": "exit_main",
                        "position": {"x": 12.0, "y": 0.0},
                        "capacity": 5.0,
                    }
                ],
            }
        ],
    }

    building = import_scenario_json(raw_data)
    assert building.name == "Standard Clinic"
    assert len(building.floors) == 1
    assert building.floors[0].rooms[0].name == "Reception"
    assert building.floors[0].exits[0].id == "exit_main"


def test_guidance_generation_and_report_export():
    """Verify multi-tier evacuation guidance generates actionable floor, room, and occupant directives."""
    sc = get_scenario("scenario_multifloor_demo")
    engine = SimulationEngine(
        scenario_config=sc,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=42,
        occupant_count_override=60,
    )

    # Initial state guidance
    guidance = generate_building_guidance(engine)
    assert guidance["buildingName"] == sc.building.name
    assert guidance["totalOccupants"] == 60
    assert guidance["evacuatedOccupants"] == 0
    assert len(guidance["floors"]) == 3
    assert len(guidance["rooms"]) > 0
    assert len(guidance["occupantsGuidance"]) > 0
    assert len(guidance["emergencyActionChecklist"]) >= 2

    # Every room recommendation must be a real route through the live graph,
    # never a straight line through walls or between floors.
    for room in guidance["rooms"]:
        if room["status"] == "unreachable":
            assert room["primaryExitId"] == "none"
            continue
        assert room["routeNodeIds"][0] == f"node_room_{room['roomId']}"
        assert room["routeNodeIds"][-1] == f"node_exit_{room['primaryExitId']}"
        assert all(
            engine.nx_graph.has_edge(u_id, v_id)
            for u_id, v_id in zip(room["routeNodeIds"], room["routeNodeIds"][1:])
        )

        if room["accessibilityStatus"] == "route_available":
            assert room["accessibleExitId"] != "none"
            assert next(e for e in engine.exits if e.id == room["accessibleExitId"]).is_wheelchair_accessible

    # A newly blocked exit is removed from every room recommendation.
    blocked_id = next(room["primaryExitId"] for room in guidance["rooms"] if room["primaryExitId"] != "none")
    next(exit_elem for exit_elem in engine.exits if exit_elem.id == blocked_id).is_blocked = True
    engine._invalidate_graph_cache()
    rerouted_guidance = generate_building_guidance(engine)
    assert all(room["primaryExitId"] != blocked_id for room in rerouted_guidance["rooms"])
    assert all(room["accessibleExitId"] != blocked_id for room in rerouted_guidance["rooms"])

    # Verify markdown generation
    md_report = format_guidance_markdown(guidance)
    assert "# EXIT-ZERO Evacuation Guidance & Emergency Brief" in md_report
    assert "Incident Commander Operational Checklist" in md_report
    assert "Floor-by-Floor Egress Directives" in md_report
    assert "Critical Room Egress Assignments" in md_report


def test_vertical_stair_traversal_elevation_continuity():
    """Ensure occupants evacuating across multiple floors maintain strict vertical grounding without falling or floating."""
    sc = get_scenario("scenario_multifloor_demo")
    engine = SimulationEngine(
        scenario_config=sc,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=101,
        occupant_count_override=50,
    )

    # Floor elevations map
    floor_elevs = {fl.id: fl.elevation for fl in sc.building.floors}

    # Step simulation through 25 iterations
    for _ in range(25):
        engine.step(dt=0.5)
        for occ in engine.occupants:
            if occ.evacuation_state.value == "exited":
                continue

            # If occupant has an active floor, their z coordinate should be physically grounded
            if occ.floor_id in floor_elevs:
                # Occupant should never drop below ground level (0.0)
                assert occ.z >= -0.01, f"Occupant {occ.id} dropped below ground level: z={occ.z}"
                # Occupant elevation should be within valid physical building bounds (<= 10.0m)
                assert occ.z <= 10.0, f"Occupant {occ.id} floating above roof: z={occ.z}"


def test_api_building_import_and_guidance_endpoints():
    """Verify legacy scaffold and guidance endpoints."""
    # 1. The legacy route name creates a bounds-based scaffold, not a GLTF parse.
    res = client.post(
        "/api/buildings/import-gltf",
        json={
            "name": "Engineering Pavilion",
            "floors_count": 2,
            "bounds": {"min_x": -20, "max_x": 20, "min_y": -15, "max_y": 15, "min_z": 0, "max_z": 6.4},
        },
    )
    assert res.status_code == 200
    b_summary = res.json()
    assert b_summary["name"] == "Engineering Pavilion"
    assert b_summary["floor_count"] == 2

    # 2. Test POST /api/guidance/generate
    res_guidance = client.post(
        "/api/guidance/generate",
        json={"scenario_id": "scenario_multifloor_demo", "algorithm": "adaptive"},
    )
    assert res_guidance.status_code == 200
    guidance_data = res_guidance.json()
    assert guidance_data["buildingName"] == "EXIT-ZERO Multi-Floor Demo"
    assert len(guidance_data["floors"]) == 3
    assert len(guidance_data["emergencyActionChecklist"]) >= 2

    # 3. Test GET /api/guidance/report/{session_id}
    init_res = client.post(
        "/api/simulation/init",
        json={"scenario_id": "scenario_multifloor_demo", "algorithm": "adaptive", "seed": 42},
    )
    assert init_res.status_code == 200
    session_id = init_res.json()["session_id"]

    res_report = client.get(f"/api/guidance/report/{session_id}")
    assert res_report.status_code == 200
    assert "EXIT-ZERO Evacuation Guidance & Emergency Brief" in res_report.text
