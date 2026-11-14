import networkx as nx
import pytest

from app.models.graph import NodeType
from app.simulation.graph_generator import BuildingGraphGenerator
from app.simulation.scenarios import build_hq_scenario, build_university_hall_scenario


def test_hq_graph_generation():
    scenario = build_hq_scenario()
    floor = scenario.building.floors[0]
    generator = BuildingGraphGenerator(waypoint_spacing=4.0)

    G, nav_model = generator.generate_floor_graph(floor)

    assert G.number_of_nodes() > 20
    assert G.number_of_edges() > 20
    assert len(nav_model.nodes) == G.number_of_nodes()
    assert len(nav_model.edges) == G.number_of_edges()

    # Check exit nodes exist
    exit_nodes = [nid for nid, n in nav_model.nodes.items() if n.node_type == NodeType.EXIT]
    assert len(exit_nodes) == 4

    # Run validation audit
    audit = generator.validate_graph(G, nav_model)
    assert audit["is_valid"] is True
    assert len(audit["unreachable_rooms"]) == 0
    assert audit["wheelchair_accessible_coverage_percent"] > 90.0


def test_university_concourse_graph_generation():
    scenario = build_university_hall_scenario()
    floor = scenario.building.floors[0]
    generator = BuildingGraphGenerator(waypoint_spacing=4.0)

    G, nav_model = generator.generate_floor_graph(floor)
    audit = generator.validate_graph(G, nav_model)

    assert audit["is_valid"] is True
    assert len(audit["unreachable_rooms"]) == 0
    assert audit["total_exits"] == 3


def test_edge_weights_and_accessibility():
    scenario = build_hq_scenario()
    floor = scenario.building.floors[0]
    generator = BuildingGraphGenerator(waypoint_spacing=4.0)
    G, nav_model = generator.generate_floor_graph(floor)

    # Edge lengths should all be positive
    for u, v, data in G.edges(data=True):
        assert data["length"] > 0
        assert data["weight"] > 0
        assert "capacity_per_sec" in data
        assert "wheelchair_accessible" in data
