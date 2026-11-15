import math
import uuid
from typing import Dict, List, Any, Optional

from app.models.building import (
    Building,
    Floor,
    Room,
    Doorway,
    Exit,
    Stairwell,
    BoundingBox,
    RoomType,
)


def import_gltf_or_cad_mesh(data: Dict[str, Any]) -> Building:
    """
    Builds a navigation scaffold from caller-supplied bounds.

    This endpoint does not decode GLTF/GLB/CAD geometry. The generated rooms,
    doors, exits, stairs, and ramps are explicit simulation placeholders and
    must never be represented as elements extracted from an uploaded model.
    Structured EXIT-ZERO JSON with explicit floors is normalized separately.
    """
    building_name = data.get("name") or data.get("title") or "Imported 3D CAD/GLTF Model"
    building_id = f"bldg_{data.get('id', uuid.uuid4().hex[:8])}"

    raw_floors = data.get("floors", [])

    if raw_floors:
        # Explicit structured geometry is preserved rather than scaffolded.
        return import_scenario_json(data)

    # 1. Height Analysis & Floor Slicing
    # Default to 3 architectural levels if raw bounds provided
    bbox = data.get("bounds", {"min_x": 0.0, "max_x": 80.0, "min_y": 0.0, "max_y": 45.0, "min_z": 0.0, "max_z": 9.6})
    total_width = max(30.0, float(bbox.get("max_x", 80.0) - bbox.get("min_x", 0.0)))
    total_depth = max(20.0, float(bbox.get("max_y", 45.0) - bbox.get("min_y", 0.0)))
    total_height = max(3.0, float(bbox.get("max_z", 9.6) - bbox.get("min_z", 0.0)))

    floor_height = 3.2
    num_floors = max(1, min(6, int(round(total_height / floor_height))))

    floors: List[Floor] = []

    for f_idx in range(num_floors):
        floor_level = f_idx + 1
        floor_id = f"floor_{floor_level}"
        elevation = round(f_idx * floor_height, 2)

        # Generate clearly labelled placeholder partitions for graph authoring.
        rooms: List[Room] = []
        doorways: List[Doorway] = []

        cols = 4
        rows = 2
        r_w = round((total_width - 15.0) / cols, 2)
        r_h = round((total_depth - 15.0) / rows, 2)

        room_idx = 0
        for r_row in range(rows):
            for r_col in range(cols):
                room_idx += 1
                rx = round(5.0 + r_col * (r_w + 2.5), 2)
                ry = round(5.0 + r_row * (r_h + 10.0), 2)
                rid = f"R-{floor_level}{room_idx:02d}"

                r_type = RoomType.OFFICE
                if f_idx == 0 and room_idx == 1:
                    r_type = RoomType.LOBBY
                elif room_idx % 3 == 0:
                    r_type = RoomType.CONFERENCE

                rooms.append(
                    Room(
                        id=rid,
                        floor_id=floor_id,
                        name=f"Generated Room {floor_level}-{room_idx}",
                        bounds=BoundingBox(x=rx, y=ry, width=r_w, height=r_h),
                        room_type=r_type,
                        max_capacity=max(4, int((r_w * r_h) / 4.0)),
                    )
                )

                # Doorway connecting room to central corridor
                door_y = ry + r_h if r_row == 0 else ry
                doorways.append(
                    Doorway(
                        id=f"D-{floor_level}{room_idx:02d}",
                        floor_id=floor_id,
                        x=round(rx + r_w / 2.0, 2),
                        y=round(door_y, 2),
                        width=1.2,
                        connects_rooms=[rid],
                    )
                )

        # Exits (Ground floor has exterior exit portals)
        exits: List[Exit] = []
        if f_idx == 0:
            exits.append(
                Exit(
                    id="exit_north_imported",
                    floor_id=floor_id,
                    name="Generated North Exit",
                    x=round(total_width / 2.0, 2),
                    y=2.0,
                    width=3.2,
                    throughput_per_sec=3.2,
                    is_wheelchair_accessible=True,
                    is_blocked=False,
                )
            )
            exits.append(
                Exit(
                    id="exit_south_imported",
                    floor_id=floor_id,
                    name="Generated South Exit",
                    x=round(total_width / 2.0, 2),
                    y=round(total_depth - 2.0, 2),
                    width=2.4,
                    throughput_per_sec=2.4,
                    is_wheelchair_accessible=True,
                    is_blocked=False,
                )
            )

        # Stairwells & Accessible Ramps
        stairwells: List[Stairwell] = []
        if f_idx < num_floors - 1:
            next_floor_id = f"floor_{floor_level + 1}"
            stairwells.append(
                Stairwell(
                    id=f"stair_east_{floor_level}_{floor_level + 1}",
                    from_floor=floor_id,
                    to_floor=next_floor_id,
                    x=round(total_width - 8.0, 2),
                    y=round(total_depth / 2.0 - 2.5, 2),
                    target_x=round(total_width - 8.0, 2),
                    target_y=round(total_depth / 2.0 + 2.5, 2),
                    width=1.8,
                    throughput_per_sec=1.8,
                    is_wheelchair_accessible=False,
                    is_ramp=False,
                )
            )
            stairwells.append(
                Stairwell(
                    id=f"ramp_west_{floor_level}_{floor_level + 1}",
                    from_floor=floor_id,
                    to_floor=next_floor_id,
                    x=round(8.0, 2),
                    y=round(total_depth / 2.0 - 2.5, 2),
                    target_x=round(8.0, 2),
                    target_y=round(total_depth / 2.0 + 2.5, 2),
                    width=2.4,
                    throughput_per_sec=2.4,
                    is_wheelchair_accessible=True,
                    is_ramp=True,
                )
            )

        floors.append(
            Floor(
                id=floor_id,
                name=f"F{floor_level} - Level {floor_level}",
                level=floor_level,
                elevation=elevation,
                floor_height=floor_height,
                width=total_width,
                height=total_depth,
                rooms=rooms,
                doorways=doorways,
                obstacles=[],
                exits=exits,
                stairwells=stairwells,
            )
        )

    return Building(
        id=building_id,
        name=building_name,
        description=(
            f"Navigation scaffold generated from supplied bounds "
            f"({num_floors} floors, {total_width:.1f}m × {total_depth:.1f}m). "
            "Rooms, doors, exits, stairs, and ramps are generated placeholders; "
            "no geometry was extracted from a GLTF/GLB/CAD file."
        ),
        author="EXIT-ZERO Bounds Scaffold Generator",
        version="1.0",
        floors=floors,
    )


def import_scenario_json(data: Dict[str, Any]) -> Building:
    """Converts raw or foreign CAD/BIM JSON schema into compliant Building model."""
    building_data = data.get("building", data)
    b_id = building_data.get("id") or f"bldg_{uuid.uuid4().hex[:8]}"
    b_name = building_data.get("name") or "Custom Scenario Building"
    b_desc = building_data.get("description") or "Imported via EXIT-ZERO Studio"

    floors: List[Floor] = []
    raw_floors = building_data.get("floors", [])

    for idx, f_raw in enumerate(raw_floors):
        f_id = f_raw.get("id") or f"floor_{idx + 1}"
        level = f_raw.get("level", idx + 1)
        elevation = f_raw.get("elevation", float(idx * 3.2))

        # Rooms
        rooms: List[Room] = []
        for r_raw in f_raw.get("rooms", []):
            bounds_raw = r_raw.get("bounds", {})
            rooms.append(
                Room(
                    id=r_raw.get("id", f"R-{idx + 1}{len(rooms) + 1}"),
                    floor_id=f_id,
                    name=r_raw.get("name", "Room"),
                    bounds=BoundingBox(
                        x=float(bounds_raw.get("x", 5.0)),
                        y=float(bounds_raw.get("y", 5.0)),
                        width=float(bounds_raw.get("width", 10.0)),
                        height=float(bounds_raw.get("height", 8.0)),
                    ),
                    room_type=RoomType(r_raw.get("room_type", "office")),
                    max_capacity=int(r_raw.get("max_capacity", 10)),
                    is_accessible=bool(r_raw.get("is_accessible", True)),
                )
            )

        # Doors
        doorways: List[Doorway] = []
        for d_raw in f_raw.get("doorways", f_raw.get("doors", [])):
            doorways.append(
                Doorway(
                    id=d_raw.get("id", f"D-{idx + 1}{len(doorways) + 1}"),
                    floor_id=f_id,
                    x=float(d_raw.get("x", 10.0)),
                    y=float(d_raw.get("y", 10.0)),
                    width=float(d_raw.get("width", 1.2)),
                    connects_rooms=d_raw.get("connects_rooms", []),
                    is_open=bool(d_raw.get("is_open", True)),
                    is_emergency_exit=bool(d_raw.get("is_emergency_exit", False)),
                )
            )

        # Exits
        exits: List[Exit] = []
        for e_raw in f_raw.get("exits", []):
            exits.append(
                Exit(
                    id=e_raw.get("id", f"exit_{idx + 1}{len(exits) + 1}"),
                    floor_id=f_id,
                    name=e_raw.get("name", "Emergency Exit"),
                    x=float(e_raw.get("x", 40.0)),
                    y=float(e_raw.get("y", 2.0)),
                    width=float(e_raw.get("width", 2.4)),
                    throughput_per_sec=float(e_raw.get("throughput_per_sec", 2.4)),
                    is_wheelchair_accessible=bool(e_raw.get("is_wheelchair_accessible", True)),
                    is_blocked=bool(e_raw.get("is_blocked", False)),
                )
            )

        # Stairs
        stairwells: List[Stairwell] = []
        for s_raw in f_raw.get("stairwells", f_raw.get("stairs", [])):
            stairwells.append(
                Stairwell(
                    id=s_raw.get("id", f"stair_{idx + 1}"),
                    from_floor=s_raw.get("from_floor", f_id),
                    to_floor=s_raw.get("to_floor", f"floor_{idx + 2}"),
                    x=float(s_raw.get("x", 60.0)),
                    y=float(s_raw.get("y", 20.0)),
                    target_x=float(s_raw.get("target_x", s_raw.get("x", 60.0))),
                    target_y=float(s_raw.get("target_y", s_raw.get("y", 25.0))),
                    width=float(s_raw.get("width", 1.8)),
                    throughput_per_sec=float(s_raw.get("throughput_per_sec", 1.8)),
                    is_wheelchair_accessible=bool(s_raw.get("is_wheelchair_accessible", False)),
                    is_ramp=bool(s_raw.get("is_ramp", False)),
                )
            )

        floors.append(
            Floor(
                id=f_id,
                name=f_raw.get("name", f"Floor {level}"),
                level=level,
                elevation=elevation,
                floor_height=float(f_raw.get("floor_height", 3.2)),
                width=float(f_raw.get("width", 80.0)),
                height=float(f_raw.get("height", 45.0)),
                rooms=rooms,
                doorways=doorways,
                obstacles=[],
                exits=exits,
                stairwells=stairwells,
            )
        )

    return Building(
        id=b_id,
        name=b_name,
        description=b_desc,
        author=building_data.get("author", "EXIT-ZERO Importer"),
        version=building_data.get("version", "1.0"),
        floors=floors,
    )
