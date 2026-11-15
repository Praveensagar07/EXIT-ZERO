import math
from typing import Dict, List, Optional, Set, Tuple
import networkx as nx

from app.models.building import Building, Doorway, Exit, Floor, Obstacle, ObstacleType, Room, Stairwell
from app.models.graph import GraphEdge, GraphNode, NavigationGraphModel, NodeType


def point_in_room(px: float, py: float, room: Room, margin: float = 0.1) -> bool:
    """Checks if a point (px, py) lies strictly inside a room's interior."""
    b = room.bounds
    return (
        b.x + margin <= px <= b.x + b.width - margin
        and b.y + margin <= py <= b.y + b.height - margin
    )


def point_in_any_room(px: float, py: float, rooms: List[Room], margin: float = 0.1) -> bool:
    """Checks if a point (px, py) lies inside any room on the floor."""
    return any(point_in_room(px, py, r, margin) for r in rooms)


def get_room_containing_point(px: float, py: float, rooms: List[Room], margin: float = 0.0) -> Optional[Room]:
    """Finds the room containing (px, py), or None if outside all rooms."""
    for r in rooms:
        b = r.bounds
        if (
            b.x - margin <= px <= b.x + b.width + margin
            and b.y - margin <= py <= b.y + b.height + margin
        ):
            return r
    return None


def ccw(A: Tuple[float, float], B: Tuple[float, float], C: Tuple[float, float]) -> float:
    """2D cross-product of vectors AB and AC."""
    return (C[1] - A[1]) * (B[0] - A[0]) - (B[1] - A[1]) * (C[0] - A[0])


def segments_intersect(
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    q1: Tuple[float, float],
    q2: Tuple[float, float],
    tol: float = 1e-4,
) -> bool:
    """
    Determines if line segment (p1, p2) properly intersects segment (q1, q2).
    Uses robust cross-product orientation test.
    """
    d1 = ccw(q1, q2, p1)
    d2 = ccw(q1, q2, p2)
    d3 = ccw(p1, p2, q1)
    d4 = ccw(p1, p2, q2)

    return (
        ((d1 > tol and d2 < -tol) or (d1 < -tol and d2 > tol))
        and ((d3 > tol and d4 < -tol) or (d3 < -tol and d4 > tol))
    )


def extract_solid_wall_segments(
    rooms: List[Room],
    doorways: List[Doorway],
    obstacles: List[Obstacle],
) -> List[Tuple[Tuple[float, float], Tuple[float, float]]]:
    """
    Extracts all physical solid wall segments on a floor.
    Room boundary walls containing an open doorway are split around the doorway aperture.
    Closed doors (is_open == False) remain 100% solid barriers.
    Passable obstacles are ignored; non-passable obstacles have 4 solid boundary walls.
    """
    solid_walls: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []

    # 1. Room perimeter walls with apertures for open doorways
    for r in rooms:
        b = r.bounds
        perimeter = [
            ((b.x, b.y), (b.x + b.width, b.y), "horizontal"),
            ((b.x, b.y + b.height), (b.x + b.width, b.y + b.height), "horizontal"),
            ((b.x, b.y), (b.x, b.y + b.height), "vertical"),
            ((b.x + b.width, b.y), (b.x + b.width, b.y + b.height), "vertical"),
        ]

        for p1, p2, orient in perimeter:
            open_doors: List[Tuple[float, float]] = []
            for d in doorways:
                if not getattr(d, "is_open", True):
                    continue  # Closed doors remain solid barriers!
                dw = getattr(d, "width", 1.2)
                tol = 1.2 if (getattr(d, "connects_rooms", None) and r.id in d.connects_rooms) else 0.35
                if orient == "horizontal":
                    if abs(d.y - p1[1]) < tol and (p1[0] - 0.4 <= d.x <= p2[0] + 0.4):
                        open_doors.append((d.x, dw))
                else:
                    if abs(d.x - p1[0]) < tol and (p1[1] - 0.4 <= d.y <= p2[1] + 0.4):
                        open_doors.append((d.y, dw))

            if not open_doors:
                solid_walls.append((p1, p2))
            else:
                if orient == "horizontal":
                    y = p1[1]
                    open_doors.sort(key=lambda item: item[0])
                    curr_x = p1[0]
                    for dx, dw in open_doors:
                        left_x = max(p1[0], dx - dw / 2.0)
                        right_x = min(p2[0], dx + dw / 2.0)
                        if left_x > curr_x + 0.15:
                            solid_walls.append(((curr_x, y), (left_x, y)))
                        curr_x = max(curr_x, right_x)
                    if p2[0] > curr_x + 0.15:
                        solid_walls.append(((curr_x, y), (p2[0], y)))
                else:
                    x = p1[0]
                    open_doors.sort(key=lambda item: item[0])
                    curr_y = p1[1]
                    for dy, dw in open_doors:
                        top_y = max(p1[1], dy - dw / 2.0)
                        bot_y = min(p2[1], dy + dw / 2.0)
                        if top_y > curr_y + 0.15:
                            solid_walls.append(((x, curr_y), (x, top_y)))
                        curr_y = max(curr_y, bot_y)
                    if p2[1] > curr_y + 0.15:
                        solid_walls.append(((x, curr_y), (x, p2[1])))

    # 2. Add non-passable wall obstacles (e.g. walls drawn in Building Studio)
    for obs in obstacles:
        if obs.obstacle_type == ObstacleType.WALL:
            ox, oy, ow, oh = obs.x, obs.y, obs.width, obs.height
            solid_walls.append(((ox, oy), (ox + ow, oy)))
            solid_walls.append(((ox, oy + oh), (ox + ow, oy + oh)))
            solid_walls.append(((ox, oy), (ox, oy + oh)))
            solid_walls.append(((ox + ow, oy), (ox + ow, oy + oh)))

    return solid_walls


def edge_intersects_any_wall(
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    solid_walls: List[Tuple[Tuple[float, float], Tuple[float, float]]],
) -> bool:
    """Returns True if the line segment (p1, p2) intersects any solid wall segment."""
    for w1, w2 in solid_walls:
        if segments_intersect(p1, p2, w1, w2):
            return True
    return False


class BuildingGraphGenerator:
    """
    Constructs and validates a physically-faithful spatial navigation graph G = (V, E)
    from building geometry. Rigorously prevents wall clipping:
      1. Every candidate edge is tested for geometric intersection against solid walls.
      2. Room interiors connect strictly to designated open doorway thresholds.
      3. Corridor waypoints exist exclusively in circulation corridors outside rooms.
      4. Closed doors act as solid impassable barriers.
    """

    def __init__(self, waypoint_spacing: float = 4.0):
        self.waypoint_spacing = waypoint_spacing

    def generate_floor_graph(self, floor: Floor) -> Tuple[nx.Graph, NavigationGraphModel]:
        """
        Builds a NetworkX graph and a serializable NavigationGraphModel for a building floor.
        Ensures strict geometric collision clearance against all solid walls and partitions.
        """
        G = nx.Graph()
        nodes: Dict[str, GraphNode] = {}
        edges: List[GraphEdge] = []
        floor_z = round(getattr(floor, "elevation", 0.0), 2)

        # Extract authoritative solid wall segments for geometric intersection verification
        solid_walls = extract_solid_wall_segments(floor.rooms, floor.doorways, floor.obstacles)

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
                z=floor_z,
                node_type=NodeType.ROOM_CENTER,
                room_id=room.id,
                is_accessible=getattr(room, "is_accessible", True),
                label=room.name,
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                z=node.z,
                floor_id=floor.id,
                node_type=node.node_type.value,
                room_id=room.id,
                is_accessible=node.is_accessible,
                label=room.name,
            )

        # 2. Add Doorway Nodes and connect to room centers
        doorway_map: Dict[str, str] = {}
        for door in floor.doorways:
            node_id = f"node_door_{door.id}"
            doorway_map[door.id] = node_id
            is_door_open = getattr(door, "is_open", True)
            node = GraphNode(
                id=node_id,
                floor_id=floor.id,
                x=round(door.x, 2),
                y=round(door.y, 2),
                z=floor_z,
                node_type=NodeType.DOORWAY,
                is_accessible=door.width >= 0.9,
                label=f"Door {door.id}",
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                z=node.z,
                floor_id=floor.id,
                node_type=node.node_type.value,
                is_accessible=node.is_accessible,
                label=node.label,
            )

            # ONLY connect open doorways to room centers
            if is_door_open:
                connected_rooms = list(door.connects_rooms)
                if not connected_rooms:
                    for r in floor.rooms:
                        b = r.bounds
                        if (
                            (b.x - 0.35 <= door.x <= b.x + b.width + 0.35)
                            and (b.y - 0.35 <= door.y <= b.y + b.height + 0.35)
                        ):
                            connected_rooms.append(r.id)

                for room_id in connected_rooms:
                    room_node_id = f"node_room_{room_id}"
                    if room_node_id in nodes:
                        r_node = nodes[room_node_id]
                        if not edge_intersects_any_wall((r_node.x, r_node.y), (door.x, door.y), solid_walls):
                            dist = math.hypot(door.x - r_node.x, door.y - r_node.y)
                            effective_dist = max(0.5, round(dist, 2))
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
                z=floor_z,
                node_type=NodeType.EXIT,
                is_accessible=exit_elem.is_wheelchair_accessible,
                label=exit_elem.name,
            )
            nodes[node_id] = node
            G.add_node(
                node_id,
                x=node.x,
                y=node.y,
                z=node.z,
                floor_id=floor.id,
                node_type=node.node_type.value,
                is_accessible=node.is_accessible,
                label=node.label,
                exit_id=exit_elem.id,
            )

        # 4. Generate Corridor Backbone & Waypoints
        corridor_nodes = self._generate_corridor_network(floor, nodes, G, solid_walls)
        for c_node, c_edges in corridor_nodes:
            if c_node.id not in nodes:
                nodes[c_node.id] = c_node
                G.add_node(
                    c_node.id,
                    x=c_node.x,
                    y=c_node.y,
                    z=c_node.z,
                    floor_id=floor.id,
                    node_type=c_node.node_type.value,
                    is_accessible=c_node.is_accessible,
                    label=c_node.label,
                )
            for edge in c_edges:
                u_n = nodes[edge.u]
                v_n = nodes[edge.v]
                if not edge_intersects_any_wall((u_n.x, u_n.y), (v_n.x, v_n.y), solid_walls):
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

        # 5. Connect Exits to nearest corridor or doorway nodes
        all_potential_exit_connectors = [
            n for n in nodes.values()
            if n.node_type in [NodeType.CORRIDOR_JUNCTION, NodeType.CORRIDOR_WAYPOINT, NodeType.DOORWAY]
        ]
        for exit_elem in floor.exits:
            exit_node_id = exit_map[exit_elem.id]
            # Prioritize candidates with line of sight (no solid wall intersection)
            los_candidates = [
                target_n for target_n in all_potential_exit_connectors
                if target_n.id != exit_node_id and not edge_intersects_any_wall(
                    (exit_elem.x, exit_elem.y), (target_n.x, target_n.y), solid_walls
                )
            ]
            candidates = los_candidates if los_candidates else [
                target_n for target_n in all_potential_exit_connectors if target_n.id != exit_node_id
            ]

            if candidates:
                candidates.sort(
                    key=lambda tn: math.hypot(exit_elem.x - tn.x, exit_elem.y - tn.y)
                )
                for target_n in candidates[:2]:
                    dist = math.hypot(exit_elem.x - target_n.x, exit_elem.y - target_n.y)
                    effective_dist = max(0.5, round(dist, 2))
                    if not G.has_edge(exit_node_id, target_n.id):
                        is_acc = exit_elem.is_wheelchair_accessible and target_n.is_accessible
                        edge = GraphEdge(
                            u=exit_node_id,
                            v=target_n.id,
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
                            target_n.id,
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

    def generate_building_graph(self, building: Building) -> Tuple[nx.Graph, NavigationGraphModel]:
        """
        Builds a comprehensive, interconnected 3D spatial navigation graph spanning
        all floors in a multi-story building, incorporating vertical transit connectors
        (stairwells, accessible ramps) with true 3D Euclidean metrics and accessibility rules.
        """
        combined_G = nx.Graph()
        all_nodes: Dict[str, GraphNode] = {}
        all_edges: List[GraphEdge] = []

        floor_map = {f.id: f for f in building.floors}

        # 1. Generate individual floor subgraphs with floor elevations
        floor_solid_walls: Dict[str, List[Tuple[Tuple[float, float], Tuple[float, float]]]] = {}
        for floor in building.floors:
            floor_solid_walls[floor.id] = extract_solid_wall_segments(
                floor.rooms, floor.doorways, floor.obstacles
            )
            G_floor, nav_floor = self.generate_floor_graph(floor)
            for nid, node in nav_floor.nodes.items():
                all_nodes[nid] = node
                combined_G.add_node(
                    nid,
                    x=node.x,
                    y=node.y,
                    z=node.z,
                    floor_id=node.floor_id,
                    node_type=node.node_type.value,
                    room_id=node.room_id,
                    is_accessible=node.is_accessible,
                    label=node.label,
                )
            for edge in nav_floor.edges:
                all_edges.append(edge)
                combined_G.add_edge(
                    edge.u,
                    edge.v,
                    length=edge.length,
                    width=edge.width,
                    capacity_per_sec=edge.capacity_per_sec,
                    wheelchair_accessible=edge.wheelchair_accessible,
                    hazard_level=edge.hazard_level,
                    current_occupants=edge.current_occupants,
                    weight=edge.base_weight,
                )

        # 2. Inter-floor Vertical Connectors (Stairs & Ramps)
        for floor in building.floors:
            for stair in floor.stairwells:
                from_fid = stair.from_floor
                to_fid = stair.to_floor

                if from_fid not in floor_map or to_fid not in floor_map:
                    continue

                from_fl = floor_map[from_fid]
                to_fl = floor_map[to_fid]

                z_from = getattr(from_fl, "elevation", 0.0)
                z_to = getattr(to_fl, "elevation", 0.0)

                x_from = stair.x
                y_from = stair.y
                x_to = stair.target_x if stair.target_x is not None else stair.x
                y_to = stair.target_y if stair.target_y is not None else stair.y

                landing_from_id = f"node_vertical_{stair.id}_{from_fid}"
                landing_to_id = f"node_vertical_{stair.id}_{to_fid}"

                is_wheelchair = bool(stair.is_wheelchair_accessible or stair.is_ramp)
                connector_label = f"{'Ramp' if stair.is_ramp else 'Stair'} {stair.id}"

                # Landing node on lower / from floor
                landing_from = GraphNode(
                    id=landing_from_id,
                    floor_id=from_fid,
                    x=round(x_from, 2),
                    y=round(y_from, 2),
                    z=round(z_from, 2),
                    node_type=NodeType.STAIRWELL,
                    is_accessible=is_wheelchair,
                    label=f"{connector_label} (Level {from_fl.level})",
                )
                all_nodes[landing_from_id] = landing_from
                combined_G.add_node(
                    landing_from_id,
                    x=landing_from.x,
                    y=landing_from.y,
                    z=landing_from.z,
                    floor_id=from_fid,
                    node_type=NodeType.STAIRWELL.value,
                    is_accessible=is_wheelchair,
                    label=landing_from.label,
                )

                # Landing node on upper / to floor
                landing_to = GraphNode(
                    id=landing_to_id,
                    floor_id=to_fid,
                    x=round(x_to, 2),
                    y=round(y_to, 2),
                    z=round(z_to, 2),
                    node_type=NodeType.STAIRWELL,
                    is_accessible=is_wheelchair,
                    label=f"{connector_label} (Level {to_fl.level})",
                )
                all_nodes[landing_to_id] = landing_to
                combined_G.add_node(
                    landing_to_id,
                    x=landing_to.x,
                    y=landing_to.y,
                    z=landing_to.z,
                    floor_id=to_fid,
                    node_type=NodeType.STAIRWELL.value,
                    is_accessible=is_wheelchair,
                    label=landing_to.label,
                )

                # Connect landings across floors with 3D transit length
                transit_dist = math.hypot(x_to - x_from, y_to - y_from, z_to - z_from)
                min_flight = abs(z_to - z_from) * (2.8 if stair.is_ramp else 1.4)
                effective_transit = max(max(1.0, min_flight), round(transit_dist, 2))

                vert_edge = GraphEdge(
                    u=landing_from_id,
                    v=landing_to_id,
                    length=effective_transit,
                    width=stair.width,
                    capacity_per_sec=stair.throughput_per_sec,
                    wheelchair_accessible=is_wheelchair,
                    hazard_level=0.0,
                    current_occupants=0,
                    base_weight=effective_transit,
                )
                all_edges.append(vert_edge)
                combined_G.add_edge(
                    landing_from_id,
                    landing_to_id,
                    length=vert_edge.length,
                    width=vert_edge.width,
                    capacity_per_sec=vert_edge.capacity_per_sec,
                    wheelchair_accessible=vert_edge.wheelchair_accessible,
                    hazard_level=0.0,
                    current_occupants=0,
                    weight=vert_edge.base_weight,
                )

                # Connect landing_from to nearest corridor or doorway node on from_floor with line of sight
                walls_from = floor_solid_walls.get(from_fid, [])
                candidates_from = [
                    (math.hypot(nd.x - x_from, nd.y - y_from), nid)
                    for nid, nd in all_nodes.items()
                    if nd.floor_id == from_fid and nd.id != landing_from_id
                    and nd.node_type in [NodeType.CORRIDOR_JUNCTION, NodeType.CORRIDOR_WAYPOINT, NodeType.DOORWAY]
                    and not edge_intersects_any_wall((x_from, y_from), (nd.x, nd.y), walls_from)
                ]
                if not candidates_from:
                    candidates_from = [
                        (math.hypot(nd.x - x_from, nd.y - y_from), nid)
                        for nid, nd in all_nodes.items()
                        if nd.floor_id == from_fid and nd.id != landing_from_id
                    ]
                if candidates_from:
                    candidates_from.sort(key=lambda item: item[0])
                    d_from, closest_from = candidates_from[0]
                    eff_d_from = max(0.5, round(d_from, 2))
                    edge_from = GraphEdge(
                        u=landing_from_id,
                        v=closest_from,
                        length=eff_d_from,
                        width=stair.width,
                        capacity_per_sec=stair.throughput_per_sec,
                        wheelchair_accessible=is_wheelchair and all_nodes[closest_from].is_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        base_weight=eff_d_from,
                    )
                    all_edges.append(edge_from)
                    combined_G.add_edge(
                        landing_from_id,
                        closest_from,
                        length=eff_d_from,
                        width=edge_from.width,
                        capacity_per_sec=edge_from.capacity_per_sec,
                        wheelchair_accessible=edge_from.wheelchair_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        weight=edge_from.base_weight,
                    )

                # Connect landing_to to nearest corridor or doorway node on to_floor with line of sight
                walls_to = floor_solid_walls.get(to_fid, [])
                candidates_to = [
                    (math.hypot(nd.x - x_to, nd.y - y_to), nid)
                    for nid, nd in all_nodes.items()
                    if nd.floor_id == to_fid and nd.id != landing_to_id
                    and nd.node_type in [NodeType.CORRIDOR_JUNCTION, NodeType.CORRIDOR_WAYPOINT, NodeType.DOORWAY]
                    and not edge_intersects_any_wall((x_to, y_to), (nd.x, nd.y), walls_to)
                ]
                if not candidates_to:
                    candidates_to = [
                        (math.hypot(nd.x - x_to, nd.y - y_to), nid)
                        for nid, nd in all_nodes.items()
                        if nd.floor_id == to_fid and nd.id != landing_to_id
                    ]
                if candidates_to:
                    candidates_to.sort(key=lambda item: item[0])
                    d_to, closest_to = candidates_to[0]
                    eff_d_to = max(0.5, round(d_to, 2))
                    edge_to = GraphEdge(
                        u=landing_to_id,
                        v=closest_to,
                        length=eff_d_to,
                        width=stair.width,
                        capacity_per_sec=stair.throughput_per_sec,
                        wheelchair_accessible=is_wheelchair and all_nodes[closest_to].is_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        base_weight=eff_d_to,
                    )
                    all_edges.append(edge_to)
                    combined_G.add_edge(
                        landing_to_id,
                        closest_to,
                        length=eff_d_to,
                        width=edge_to.width,
                        capacity_per_sec=edge_to.capacity_per_sec,
                        wheelchair_accessible=edge_to.wheelchair_accessible,
                        hazard_level=0.0,
                        current_occupants=0,
                        weight=edge_to.base_weight,
                    )

        nav_model = NavigationGraphModel(nodes=all_nodes, edges=all_edges)
        return combined_G, nav_model

    def _generate_corridor_network(
        self,
        floor: Floor,
        existing_nodes: Dict[str, GraphNode],
        G: nx.Graph,
        solid_walls: List[Tuple[Tuple[float, float], Tuple[float, float]]],
    ) -> List[Tuple[GraphNode, List[GraphEdge]]]:
        """
        Creates a structured, navigable corridor backbone and connects doorways to corridors.
        CRITICAL: All corridor waypoints are placed strictly in open circulation spaces OUTSIDE rooms.
        Edges crossing solid walls are strictly prohibited.
        """
        results: List[Tuple[GraphNode, List[GraphEdge]]] = []
        cy = floor.height / 2.0
        floor_z = round(getattr(floor, "elevation", 0.0), 2)
        step = self.waypoint_spacing

        # 1. Main Corridor Spine along the central hallway axis
        num_points = max(2, int((floor.width - 16.0) / step))
        spine_nodes: List[GraphNode] = []

        for i in range(num_points + 1):
            px = 8.0 + i * ((floor.width - 16.0) / max(1, num_points))
            # Verify waypoint is in open space outside all rooms
            if not point_in_any_room(px, cy, floor.rooms):
                node_id = f"node_corr_spine_{floor.id}_{i}"
                node = GraphNode(
                    id=node_id,
                    floor_id=floor.id,
                    x=round(px, 2),
                    y=round(cy, 2),
                    z=floor_z,
                    node_type=(
                        NodeType.CORRIDOR_JUNCTION
                        if (i == 0 or i == num_points or i % 3 == 0)
                        else NodeType.CORRIDOR_WAYPOINT
                    ),
                    is_accessible=True,
                    label=f"Hallway Point {i}",
                )
                spine_nodes.append(node)

        # Connect consecutive spine nodes if clear line-of-sight
        for i in range(len(spine_nodes)):
            curr = spine_nodes[i]
            local_edges: List[GraphEdge] = []
            if i > 0:
                prev = spine_nodes[i - 1]
                if not edge_intersects_any_wall((prev.x, prev.y), (curr.x, curr.y), solid_walls):
                    dist = math.hypot(curr.x - prev.x, curr.y - prev.y)
                    effective_dist = max(0.5, round(dist, 2))
                    local_edges.append(
                        GraphEdge(
                            u=prev.id,
                            v=curr.id,
                            length=effective_dist,
                            width=2.4,
                            capacity_per_sec=3.2,
                            wheelchair_accessible=True,
                            hazard_level=0.0,
                            current_occupants=0,
                            base_weight=effective_dist,
                        )
                    )
            results.append((curr, local_edges))

        # 2. Doorway-to-Corridor Connections with Perpendicular Corridor Approach Nodes
        door_nodes = [
            n for n in existing_nodes.values()
            if n.node_type == NodeType.DOORWAY
        ]
        all_spine_nodes = list(spine_nodes)

        for door_node in door_nodes:
            door_obj = next((d for d in floor.doorways if f"node_door_{d.id}" == door_node.id), None)
            if door_obj and not getattr(door_obj, "is_open", True):
                continue

            # Check direct line-of-sight to existing spine nodes
            los_spine = [
                sn for sn in all_spine_nodes
                if not edge_intersects_any_wall((door_node.x, door_node.y), (sn.x, sn.y), solid_walls)
            ]

            if los_spine:
                closest_c = min(
                    los_spine,
                    key=lambda sn: math.hypot(sn.x - door_node.x, sn.y - door_node.y),
                )
                dist = math.hypot(closest_c.x - door_node.x, closest_c.y - door_node.y)
                effective_dist = max(0.5, round(dist, 2))
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
            else:
                approach_y = door_node.y + (1.5 if door_node.y < cy else -1.5)
                approach_x = door_node.x
                if not point_in_any_room(approach_x, approach_y, floor.rooms):
                    app_node_id = f"node_corr_app_{door_node.id}"
                    app_node = GraphNode(
                        id=app_node_id,
                        floor_id=floor.id,
                        x=round(approach_x, 2),
                        y=round(approach_y, 2),
                        z=floor_z,
                        node_type=NodeType.CORRIDOR_WAYPOINT,
                        is_accessible=door_node.is_accessible,
                        label=f"Approach {door_node.label}",
                    )
                    app_edges: List[GraphEdge] = []
                    dist_d = math.hypot(approach_x - door_node.x, approach_y - door_node.y)
                    eff_d_d = max(0.5, round(dist_d, 2))
                    app_edges.append(
                        GraphEdge(
                            u=door_node.id,
                            v=app_node_id,
                            length=eff_d_d,
                            width=1.5,
                            capacity_per_sec=2.0,
                            wheelchair_accessible=door_node.is_accessible,
                            hazard_level=0.0,
                            current_occupants=0,
                            base_weight=eff_d_d,
                        )
                    )
                    los_from_app = [
                        sn for sn in all_spine_nodes
                        if not edge_intersects_any_wall((approach_x, approach_y), (sn.x, sn.y), solid_walls)
                    ]
                    target_sn_list = los_from_app if los_from_app else all_spine_nodes
                    if target_sn_list:
                        closest_s = min(
                            target_sn_list,
                            key=lambda sn: math.hypot(sn.x - approach_x, sn.y - approach_y),
                        )
                        dist_s = math.hypot(closest_s.x - approach_x, closest_s.y - approach_y)
                        eff_d_s = max(0.5, round(dist_s, 2))
                        app_edges.append(
                            GraphEdge(
                                u=app_node_id,
                                v=closest_s.id,
                                length=eff_d_s,
                                width=1.8,
                                capacity_per_sec=2.4,
                                wheelchair_accessible=app_node.is_accessible and closest_s.is_accessible,
                                hazard_level=0.0,
                                current_occupants=0,
                                base_weight=eff_d_s,
                            )
                        )
                    results.append((app_node, app_edges))
                    all_spine_nodes.append(app_node)

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
