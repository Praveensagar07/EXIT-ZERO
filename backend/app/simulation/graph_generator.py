import math
from typing import Dict, List, Tuple
import networkx as nx

from app.models.building import Building, Doorway, Exit, Floor, Room
from app.models.graph import GraphEdge, GraphNode, NavigationGraphModel, NodeType


class BuildingGraphGenerator:
    """
    Constructs and validates a high-fidelity spatial navigation graph G = (V, E)
    from building geometry. Discretizes corridors and hallways into navigable
    waypoints to facilitate microscopic density tracking and realistic crowd movement.
    """

    def __init__(self, waypoint_spacing: float = 4.0):
        self.waypoint_spacing = waypoint_spacing

    def generate_floor_graph(self, floor: Floor) -> Tuple[nx.Graph, NavigationGraphModel]:
        """
        Builds a NetworkX graph and a serializable NavigationGraphModel for a building floor.
        """
        G = nx.Graph()
        nodes: Dict[str, GraphNode] = {}
        edges: List[GraphEdge] = []

        # 1. Add Room Center Nodes
        for room in floor.rooms:
            node_id = f"node_room_{room.id}"
            center_x = room.bounds.x + room.bounds.width / 2.0
            center_y = room.bounds.y + room.bounds.height / 2.0
            node = GraphNode(
                id=node_id,
                floor_id=floor.id,
                x=round(center_x, 2),
                y=round(center_y, 2),
                node_type=NodeType.ROOM_CENTER,
                room_id=room.id,
                is_accessible=True,
                label=room.name,
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                floor_id=floor.id,
                node_type=node.node_type.value,
                room_id=room.id,
                is_accessible=True,
                label=room.name,
            )

        # 2. Add Doorway Nodes
        doorway_map: Dict[str, str] = {}
        for door in floor.doorways:
            node_id = f"node_door_{door.id}"
            doorway_map[door.id] = node_id
            node = GraphNode(
                id=node_id,
                floor_id=floor.id,
                x=round(door.x, 2),
                y=round(door.y, 2),
                node_type=NodeType.DOORWAY,
                is_accessible=door.width >= 0.9,  # ADA standard: >=0.9m for wheelchair accessibility
                label=f"Door {door.id}",
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                floor_id=floor.id,
                node_type=node.node_type.value,
                is_accessible=node.is_accessible,
                label=node.label,
            )

            # Connect doorway to room center(s)
            for room_id in door.connects_rooms:
                room_node_id = f"node_room_{room_id}"
                if room_node_id in nodes:
                    r_node = nodes[room_node_id]
                    dist = math.hypot(door.x - r_node.x, door.y - r_node.y)
                    effective_dist = max(0.5, round(dist, 2))
                    # Capacity based on doorway width (standard 1.33 persons/m/sec)
                    capacity = max(1.0, round(door.width * 1.33, 2))
                    edge = GraphEdge(
                        u=room_node_id,
                        v=node_id,
                        length=effective_dist,
                        width=door.width,
                        capacity_per_sec=capacity,
                        wheelchair_accessible=node.is_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        base_weight=effective_dist,
                    )
                    edges.append(edge)
                    G.add_edge(
                        room_node_id,
                        node_id,
                        length=edge.length,
                        width=edge.width,
                        capacity_per_sec=edge.capacity_per_sec,
                        wheelchair_accessible=edge.wheelchair_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        weight=edge.base_weight,
                    )

        # 3. Add Exit Nodes
        exit_map: Dict[str, str] = {}
        for exit_elem in floor.exits:
            node_id = f"node_exit_{exit_elem.id}"
            exit_map[exit_elem.id] = node_id
            node = GraphNode(
                id=node_id,
                floor_id=floor.id,
                x=round(exit_elem.x, 2),
                y=round(exit_elem.y, 2),
                node_type=NodeType.EXIT,
                is_accessible=exit_elem.is_wheelchair_accessible,
                label=exit_elem.name,
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                floor_id=floor.id,
                node_type=node.node_type.value,
                is_accessible=node.is_accessible,
                label=node.label,
                exit_id=exit_elem.id,
            )

        # 4. Generate Corridor Backbone & Waypoints
        # Synthesize corridor spine connecting doors and exits
        corridor_nodes = self._generate_corridor_network(floor, nodes, G)
        for c_node, c_edges in corridor_nodes:
            if c_node.id not in nodes:
                nodes[c_node.id] = c_node
                G.add_node(
                    c_node.id,
                    x=c_node.x,
                    y=c_node.y,
                    floor_id=floor.id,
                    node_type=c_node.node_type.value,
                    is_accessible=c_node.is_accessible,
                    label=c_node.label,
                )
            for edge in c_edges:
                edges.append(edge)
                G.add_edge(
                    edge.u,
                    edge.v,
                    length=edge.length,
                    width=edge.width,
                    capacity_per_sec=edge.capacity_per_sec,
                    wheelchair_accessible=edge.wheelchair_accessible,
                    hazard_level=0.0,
                    current_occupants=0,
                    weight=edge.base_weight,
                )

        # 5. Connect Exits to nearest corridor nodes
        for exit_elem in floor.exits:
            exit_node_id = exit_map[exit_elem.id]
            # Find closest corridor or doorway node
            candidates = [
                n_id for n_id, n_data in nodes.items()
                if n_id != exit_node_id and n_data.node_type in [NodeType.CORRIDOR_JUNCTION, NodeType.CORRIDOR_WAYPOINT, NodeType.DOORWAY]
            ]
            if candidates:
                # Pick up to 2 closest candidates within 15 meters
                candidates.sort(
                    key=lambda nid: math.hypot(nodes[nid].x - exit_elem.x, nodes[nid].y - exit_elem.y)
                )
                for target_id in candidates[:2]:
                    target_node = nodes[target_id]
                    dist = math.hypot(exit_elem.x - target_node.x, exit_elem.y - target_node.y)
                    effective_dist = max(0.5, round(dist, 2))
                    if dist <= 20.0 and not G.has_edge(exit_node_id, target_id):
                        is_acc = exit_elem.is_wheelchair_accessible and target_node.is_accessible
                        edge = GraphEdge(
                            u=exit_node_id,
                            v=target_id,
                            length=effective_dist,
                            width=exit_elem.width,
                            capacity_per_sec=exit_elem.throughput_per_sec,
                            wheelchair_accessible=is_acc,
                            hazard_level=0.0,
                            current_occupants=0,
                            base_weight=effective_dist,
                        )
                        edges.append(edge)
                        G.add_edge(
                            exit_node_id,
                            target_id,
                            length=edge.length,
                            width=edge.width,
                            capacity_per_sec=edge.capacity_per_sec,
                            wheelchair_accessible=edge.wheelchair_accessible,
                            hazard_level=0.0,
                            current_occupants=0,
                            weight=edge.base_weight,
                        )

        nav_model = NavigationGraphModel(nodes=nodes, edges=edges)
        return G, nav_model

    def _generate_corridor_network(
        self, floor: Floor, existing_nodes: Dict[str, GraphNode], G: nx.Graph
    ) -> List[Tuple[GraphNode, List[GraphEdge]]]:
        """
        Creates a structured, navigable corridor backbone and connects doors to corridors.
        """
        results: List[Tuple[GraphNode, List[GraphEdge]]] = []

        # Find corridor bounding boxes or estimate the central hallway axis
        # Default corridor structure for modern commercial floors:
        # Central main spine along y = height/2 or spanning lengthwise with lateral loops
        cy = floor.height / 2.0
        
        # Discretize corridor spine from x=5m to x=width-5m with waypoint_spacing
        spine_nodes: List[GraphNode] = []
        step = self.waypoint_spacing
        num_points = max(2, int((floor.width - 16.0) / step))
        
        for i in range(num_points + 1):
            px = 8.0 + i * ((floor.width - 16.0) / max(1, num_points))
            node_id = f"node_corr_spine_{floor.id}_{i}"
            node = GraphNode(
                id=node_id,
                floor_id=floor.id,
                x=round(px, 2),
                y=round(cy, 2),
                node_type=NodeType.CORRIDOR_JUNCTION if (i == 0 or i == num_points or i % 3 == 0) else NodeType.CORRIDOR_WAYPOINT,
                is_accessible=True,
                label=f"Hallway Point {i}",
            )
            spine_nodes.append(node)

        # Add edges between consecutive spine nodes
        for i in range(len(spine_nodes)):
            curr = spine_nodes[i]
            local_edges: List[GraphEdge] = []
            if i > 0:
                prev = spine_nodes[i - 1]
                dist = math.hypot(curr.x - prev.x, curr.y - prev.y)
                effective_dist = max(0.5, round(dist, 2))
                local_edges.append(
                    GraphEdge(
                        u=prev.id,
                        v=curr.id,
                        length=effective_dist,
                        width=2.4, # 2.4m wide main hallway
                        capacity_per_sec=3.2,
                        wheelchair_accessible=True,
                        hazard_level=0.0,
                        current_occupants=0,
                        base_weight=effective_dist,
                    )
                )
            results.append((curr, local_edges))

        # Secondary corridor loops if building has height >= 35m (e.g., North/South wings)
        if floor.height >= 35.0:
            north_y = cy - 12.0
            south_y = cy + 12.0
            for wing_name, wy in [("north", north_y), ("south", south_y)]:
                wing_nodes: List[GraphNode] = []
                w_points = max(2, int((floor.width - 24.0) / (step * 1.5)))
                for j in range(w_points + 1):
                    wx = 12.0 + j * ((floor.width - 24.0) / max(1, w_points))
                    node_id = f"node_corr_{wing_name}_{floor.id}_{j}"
                    node = GraphNode(
                        id=node_id,
                        floor_id=floor.id,
                        x=round(wx, 2),
                        y=round(wy, 2),
                        node_type=NodeType.CORRIDOR_WAYPOINT,
                        is_accessible=True,
                        label=f"{wing_name.capitalize()} Wing {j}",
                    )
                    wing_nodes.append(node)

                # Connect along the wing
                for k in range(len(wing_nodes)):
                    w_curr = wing_nodes[k]
                    w_edges: List[GraphEdge] = []
                    if k > 0:
                        w_prev = wing_nodes[k - 1]
                        dist = math.hypot(w_curr.x - w_prev.x, w_curr.y - w_prev.y)
                        effective_dist = max(0.5, round(dist, 2))
                        w_edges.append(
                            GraphEdge(
                                u=w_prev.id,
                                v=w_curr.id,
                                length=effective_dist,
                                width=2.0,
                                capacity_per_sec=2.6,
                                wheelchair_accessible=True,
                                hazard_level=0.0,
                                current_occupants=0,
                                base_weight=effective_dist,
                            )
                        )
                    results.append((w_curr, w_edges))

                # Cross-connect wing ends and midpoints to central spine
                for wing_idx in [0, len(wing_nodes) // 2, len(wing_nodes) - 1]:
                    wn = wing_nodes[wing_idx]
                    # Find closest spine node
                    closest_spine = min(
                        spine_nodes, key=lambda sn: math.hypot(sn.x - wn.x, sn.y - wn.y)
                    )
                    dist = math.hypot(closest_spine.x - wn.x, closest_spine.y - wn.y)
                    effective_dist = max(0.5, round(dist, 2))
                    results.append(
                        (
                            wn,
                            [
                                GraphEdge(
                                    u=wn.id,
                                    v=closest_spine.id,
                                    length=effective_dist,
                                    width=2.0,
                                    capacity_per_sec=2.6,
                                    wheelchair_accessible=True,
                                    hazard_level=0.0,
                                    current_occupants=0,
                                    base_weight=effective_dist,
                                )
                            ],
                        )
                    )

        # Connect all doorways to the nearest corridor node
        all_corridor_nodes = [node for node, _ in results]
        door_nodes = [n for n in existing_nodes.values() if n.node_type == NodeType.DOORWAY]
        for door_node in door_nodes:
            if all_corridor_nodes:
                closest_c = min(
                    all_corridor_nodes,
                    key=lambda cn: math.hypot(cn.x - door_node.x, cn.y - door_node.y),
                )
                dist = math.hypot(closest_c.x - door_node.x, closest_c.y - door_node.y)
                effective_dist = max(0.5, round(dist, 2))
                # Link doorway to corridor
                results.append(
                    (
                        door_node,
                        [
                            GraphEdge(
                                u=door_node.id,
                                v=closest_c.id,
                                length=effective_dist,
                                width=1.5,
                                capacity_per_sec=2.0,
                                wheelchair_accessible=door_node.is_accessible and closest_c.is_accessible,
                                hazard_level=0.0,
                                current_occupants=0,
                                base_weight=effective_dist,
                            )
                        ],
                    )
                )

        return results

    def validate_graph(
        self, G: nx.Graph, nav_model: NavigationGraphModel
    ) -> Dict[str, object]:
        """
        Runs rigorous topological and safety accessibility checks on the building graph.
        Returns a detailed audit report.
        """
        is_connected = nx.is_connected(G) if len(G) > 0 else False
        num_components = nx.number_connected_components(G) if len(G) > 0 else 0
        
        # Identify exits
        exit_nodes = [
            nid for nid, n in nav_model.nodes.items() if n.node_type == NodeType.EXIT
        ]
        room_nodes = [
            nid for nid, n in nav_model.nodes.items() if n.node_type == NodeType.ROOM_CENTER
        ]
        
        # Check path from each room to at least one exit
        unreachable_rooms: List[str] = []
        room_shortest_exit_dists: Dict[str, float] = {}

        for r_id in room_nodes:
            reachable = False
            min_dist = float("inf")
            for e_id in exit_nodes:
                if nx.has_path(G, r_id, e_id):
                    reachable = True
                    length = nx.shortest_path_length(G, r_id, e_id, weight="weight")
                    if length < min_dist:
                        min_dist = length
            if not reachable:
                unreachable_rooms.append(r_id)
            else:
                room_shortest_exit_dists[r_id] = round(min_dist, 2)

        # Check wheelchair accessible subgraph
        # Create subgraph containing only wheelchair_accessible edges and nodes
        accessible_edges = [
            (u, v) for u, v, d in G.edges(data=True) if d.get("wheelchair_accessible", True)
        ]
        G_acc = G.edge_subgraph(accessible_edges).copy()
        
        accessible_exit_nodes = [
            nid for nid in exit_nodes if nav_model.nodes[nid].is_accessible
        ]
        
        unreachable_accessible_rooms: List[str] = []
        for r_id in room_nodes:
            if r_id in G_acc:
                acc_reachable = any(
                    e_id in G_acc and nx.has_path(G_acc, r_id, e_id)
                    for e_id in accessible_exit_nodes
                )
                if not acc_reachable:
                    unreachable_accessible_rooms.append(r_id)
            else:
                unreachable_accessible_rooms.append(r_id)

        # Compute summary metrics
        edge_lengths = [d.get("length", 1.0) for _, _, d in G.edges(data=True)]
        avg_edge_length = round(sum(edge_lengths) / max(1, len(edge_lengths)), 2)

        return {
            "is_valid": len(unreachable_rooms) == 0 and len(exit_nodes) > 0,
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "is_connected": is_connected,
            "connected_components_count": num_components,
            "total_exits": len(exit_nodes),
            "accessible_exits_count": len(accessible_exit_nodes),
            "unreachable_rooms": unreachable_rooms,
            "wheelchair_accessible_coverage_percent": round(
                (1.0 - len(unreachable_accessible_rooms) / max(1, len(room_nodes))) * 100.0, 1
            ),
            "unreachable_accessible_rooms": unreachable_accessible_rooms,
            "average_edge_length_meters": avg_edge_length,
            "room_shortest_exit_dists": room_shortest_exit_dists,
        }
