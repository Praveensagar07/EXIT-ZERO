from typing import Dict, List
import json
import os

from app.models.building import (
    BoundingBox,
    Building,
    Doorway,
    Exit,
    Floor,
    HazardSource,
    HazardType,
    Obstacle,
    ObstacleType,
    Room,
    RoomType,
    SpawnZone,
    Stairwell,
)
from app.models.scenario import (
    AlgorithmWeights,
    ScenarioConfig,
    ScenarioEvent,
    ScenarioEventType,
    ScenarioSummary,
)


def create_standard_hq_floor(floor_id: str = "floor_1") -> Floor:
    """Helper creating standard Corporate HQ floor geometry."""
    return Floor(
        id=floor_id,
        name="Ground Operations & Corporate Suites",
        level=1,
        width=80.0,
        height=45.0,
        rooms=[
            # North Wing Offices
            Room(id="room_101", floor_id=floor_id, name="Executive Suite 101", bounds=BoundingBox(x=5.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=10),
            Room(id="room_102", floor_id=floor_id, name="Finance Office 102", bounds=BoundingBox(x=19.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=12),
            Room(id="room_103", floor_id=floor_id, name="Main Boardroom A", bounds=BoundingBox(x=33.0, y=5.0, width=16.0, height=10.0), room_type=RoomType.CONFERENCE, max_capacity=25),
            Room(id="room_104", floor_id=floor_id, name="Engineering Lab 104", bounds=BoundingBox(x=51.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.LAB, max_capacity=15),
            Room(id="room_105", floor_id=floor_id, name="Server & Telecom Room", bounds=BoundingBox(x=65.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.STORAGE, max_capacity=5),
            
            # Central Hub
            Room(id="room_hub", floor_id=floor_id, name="Central Atrium & Cafeteria", bounds=BoundingBox(x=28.0, y=17.0, width=24.0, height=11.0), room_type=RoomType.CAFETERIA, max_capacity=45),
            
            # South Wing Offices
            Room(id="room_201", floor_id=floor_id, name="Operations Center 201", bounds=BoundingBox(x=5.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=18),
            Room(id="room_202", floor_id=floor_id, name="Product Design 202", bounds=BoundingBox(x=21.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=14),
            Room(id="room_203", floor_id=floor_id, name="Conference Room B", bounds=BoundingBox(x=35.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.CONFERENCE, max_capacity=20),
            Room(id="room_204", floor_id=floor_id, name="Legal & Compliance 204", bounds=BoundingBox(x=51.0, y=30.0, width=11.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=12),
            Room(id="room_205", floor_id=floor_id, name="Restrooms & Lockers", bounds=BoundingBox(x=64.0, y=30.0, width=11.0, height=10.0), room_type=RoomType.RESTROOM, max_capacity=10),
        ],
        doorways=[
            Doorway(id="door_101", floor_id=floor_id, x=11.0, y=15.0, width=1.1, connects_rooms=["room_101"]),
            Doorway(id="door_102", floor_id=floor_id, x=25.0, y=15.0, width=1.1, connects_rooms=["room_102"]),
            Doorway(id="door_103", floor_id=floor_id, x=41.0, y=15.0, width=1.8, connects_rooms=["room_103"]),
            Doorway(id="door_104", floor_id=floor_id, x=57.0, y=15.0, width=1.2, connects_rooms=["room_104"]),
            Doorway(id="door_105", floor_id=floor_id, x=70.0, y=15.0, width=1.0, connects_rooms=["room_105"]),
            
            Doorway(id="door_hub_n", floor_id=floor_id, x=40.0, y=17.0, width=2.2, connects_rooms=["room_hub"]),
            Doorway(id="door_hub_s", floor_id=floor_id, x=40.0, y=28.0, width=2.2, connects_rooms=["room_hub"]),
            Doorway(id="door_hub_w", floor_id=floor_id, x=28.0, y=22.5, width=1.8, connects_rooms=["room_hub"]),
            Doorway(id="door_hub_e", floor_id=floor_id, x=52.0, y=22.5, width=1.8, connects_rooms=["room_hub"]),

            Doorway(id="door_201", floor_id=floor_id, x=12.0, y=30.0, width=1.2, connects_rooms=["room_201"]),
            Doorway(id="door_202", floor_id=floor_id, x=27.0, y=30.0, width=1.1, connects_rooms=["room_202"]),
            Doorway(id="door_203", floor_id=floor_id, x=42.0, y=30.0, width=1.6, connects_rooms=["room_203"]),
            Doorway(id="door_204", floor_id=floor_id, x=56.5, y=30.0, width=1.1, connects_rooms=["room_204"]),
            Doorway(id="door_205", floor_id=floor_id, x=69.5, y=30.0, width=1.1, connects_rooms=["room_205"]),
        ],
        obstacles=[
            Obstacle(id="col_1", floor_id=floor_id, x=20.0, y=22.0, width=1.2, height=1.2, obstacle_type=ObstacleType.COLUMN),
            Obstacle(id="col_2", floor_id=floor_id, x=60.0, y=22.0, width=1.2, height=1.2, obstacle_type=ObstacleType.COLUMN),
            Obstacle(id="col_3", floor_id=floor_id, x=15.0, y=15.0, width=1.0, height=1.0, obstacle_type=ObstacleType.COLUMN),
            Obstacle(id="col_4", floor_id=floor_id, x=65.0, y=15.0, width=1.0, height=1.0, obstacle_type=ObstacleType.COLUMN),
        ],
        exits=[
            Exit(id="exit_north_main", floor_id=floor_id, name="Exit A: North Grand Portal", x=40.0, y=2.0, width=3.0, throughput_per_sec=3.2, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_east_fire", floor_id=floor_id, name="Exit B: East Fire Escape", x=77.0, y=22.5, width=1.8, throughput_per_sec=2.0, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_south_emergency", floor_id=floor_id, name="Exit C: South Stair Exit", x=40.0, y=43.0, width=2.0, throughput_per_sec=1.8, is_wheelchair_accessible=False, is_blocked=False),
            Exit(id="exit_west_ramp", floor_id=floor_id, name="Exit D: West Accessible Ramp", x=3.0, y=22.5, width=2.4, throughput_per_sec=2.5, is_wheelchair_accessible=True, is_blocked=False),
        ],
        stairwells=[
            Stairwell(id="stair_south", from_floor=floor_id, to_floor="floor_2", x=37.0, y=41.0, width=1.8, throughput_per_sec=1.5, is_wheelchair_accessible=False),
        ]
    )


def build_normal_evacuation_scenario() -> ScenarioConfig:
    """
    Scenario 1: Normal Evacuation
    Multi-room commercial office layout with all 4 exits fully operational and zero hazards.
    Tests baseline shortest-path versus EXIT-ZERO queue-balancing under clean conditions.
    """
    floor = create_standard_hq_floor("floor_norm")
    building = Building(id="bldg_hq_norm", name="Apex Innovation HQ (Normal)", description="Standard evacuation baseline calibration", floors=[floor])

    spawn_zones = [
        SpawnZone(id="sp_north_norm", floor_id="floor_norm", name="North Wing Staff", bounds=BoundingBox(x=6.0, y=6.0, width=58.0, height=8.0), occupant_count=45, wheelchair_ratio=0.06, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_atrium_norm", floor_id="floor_norm", name="Atrium Occupants", bounds=BoundingBox(x=30.0, y=18.0, width=20.0, height=9.0), occupant_count=45, wheelchair_ratio=0.08, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_south_norm", floor_id="floor_norm", name="South Operations", bounds=BoundingBox(x=6.0, y=31.0, width=58.0, height=8.0), occupant_count=40, wheelchair_ratio=0.08, reduced_mobility_ratio=0.15),
        SpawnZone(id="sp_corr_norm", floor_id="floor_norm", name="Hallway Traffic", bounds=BoundingBox(x=10.0, y=20.0, width=60.0, height=5.0), occupant_count=20, wheelchair_ratio=0.05, reduced_mobility_ratio=0.05),
    ]

    return ScenarioConfig(
        id="scenario_normal_evacuation",
        name="Scenario 1: Normal Evacuation (All Exits Clear)",
        description="Clean multi-exit evacuation with zero active hazards. Calibrates baseline shortest-path vs adaptive queue-balancing under uncompromised building conditions.",
        building=building,
        hazard_sources=[],
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=150,
        default_seed=42,
    )


def build_hq_scenario() -> ScenarioConfig:
    """Scenario 1: Standard Corporate HQ."""
    floor = create_standard_hq_floor("floor_1")
    building = Building(id="bldg_corporate_hq", name="Apex Innovation HQ", description="Flagship corporate complex", floors=[floor])

    hazard = HazardSource(
        id="fire_electrical", floor_id="floor_1", x=68.0, y=8.0, hazard_type=HazardType.FIRE,
        start_time_sec=15.0, growth_rate=0.18, max_radius=18.0, intensity=1.0,
    )

    spawn_zones = [
        SpawnZone(id="spawn_north_offices", floor_id="floor_1", name="North Wing Occupants", bounds=BoundingBox(x=6.0, y=6.0, width=58.0, height=8.0), occupant_count=45, wheelchair_ratio=0.06, reduced_mobility_ratio=0.10),
        SpawnZone(id="spawn_atrium", floor_id="floor_1", name="Atrium & Dining Crowd", bounds=BoundingBox(x=30.0, y=18.0, width=20.0, height=9.0), occupant_count=45, wheelchair_ratio=0.10, reduced_mobility_ratio=0.12),
        SpawnZone(id="spawn_south_offices", floor_id="floor_1", name="South Operations", bounds=BoundingBox(x=6.0, y=31.0, width=58.0, height=8.0), occupant_count=40, wheelchair_ratio=0.08, reduced_mobility_ratio=0.15),
        SpawnZone(id="spawn_corridors", floor_id="floor_1", name="Transit Hallway Foot-traffic", bounds=BoundingBox(x=10.0, y=20.0, width=60.0, height=5.0), occupant_count=20, wheelchair_ratio=0.05, reduced_mobility_ratio=0.05),
    ]

    return ScenarioConfig(
        id="scenario_hq_floor1",
        name="Corporate HQ: Multi-Exit Emergency Egress",
        description="Standard 150-person commercial office layout with an active fire spreading in the east wing.",
        building=building,
        hazard_sources=[hazard],
        spawn_zones=spawn_zones,
        total_occupants=150,
        default_seed=42,
    )


def build_scenario_a_sudden_exit_closure() -> ScenarioConfig:
    """
    Scenario A: Sudden Exit Closure
    Exit B (East Fire Escape) is initially open and closest to East Wing occupants.
    At t = 18.0s, Exit B suddenly blocks due to structural collapse.
    Baseline occupants continue to queue at the blocked door until they hit it.
    EXIT-ZERO adaptive intelligence detects the closure and dynamically reroutes occupants toward Exit A & D.
    """
    floor = create_standard_hq_floor("floor_a")
    building = Building(id="bldg_hq_a", name="Apex Innovation HQ (Scenario A)", description="Sudden exit blockage demonstration", floors=[floor])

    events = [
        ScenarioEvent(
            time_sec=18.0,
            event_type=ScenarioEventType.BLOCK_EXIT,
            target_id="exit_east_fire",
            description="East Fire Escape door fails / debris blockage.",
        )
    ]

    spawn_zones = [
        SpawnZone(id="sp_east_dense", floor_id="floor_a", name="East Wing Staff", bounds=BoundingBox(x=45.0, y=6.0, width=28.0, height=25.0), occupant_count=70, wheelchair_ratio=0.08, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_atrium", floor_id="floor_a", name="Atrium Crowd", bounds=BoundingBox(x=28.0, y=18.0, width=22.0, height=8.0), occupant_count=50, wheelchair_ratio=0.06, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_west", floor_id="floor_a", name="West Wing Staff", bounds=BoundingBox(x=6.0, y=8.0, width=20.0, height=22.0), occupant_count=30, wheelchair_ratio=0.05, reduced_mobility_ratio=0.05),
    ]

    return ScenarioConfig(
        id="scenario_sudden_exit_closure",
        name="Scenario A: Sudden Exit Closure",
        description="Exit B (East Fire Escape) unexpectedly blocks at t=18.0s. Tests adaptive failure-awareness and immediate non-oscillating rerouting away from trapped dead-ends.",
        building=building,
        hazard_sources=[],
        spawn_zones=spawn_zones,
        events=events,
        total_occupants=150,
        default_seed=101,
    )


def build_scenario_b_congested_corridor() -> ScenarioConfig:
    """
    Scenario B: Congested Central Corridor
    High density (200 occupants) in central auditorium/atrium.
    The direct central spine creates extreme congestion crush (>4.0 pers/m²).
    Baseline jams into the single shortest hallway; EXIT-ZERO anticipates congestion and distributes occupants across North & South corridors.
    """
    floor = create_standard_hq_floor("floor_b")
    building = Building(id="bldg_hq_b", name="Apex Innovation HQ (Scenario B)", description="Congested central corridor demonstration", floors=[floor])

    spawn_zones = [
        SpawnZone(id="sp_crowd_hub", floor_id="floor_b", name="Packed Central Atrium", bounds=BoundingBox(x=30.0, y=18.0, width=20.0, height=9.0), occupant_count=130, wheelchair_ratio=0.07, reduced_mobility_ratio=0.08),
        SpawnZone(id="sp_hallway_spill", floor_id="floor_b", name="Corridor Foot-traffic", bounds=BoundingBox(x=20.0, y=20.0, width=40.0, height=5.0), occupant_count=70, wheelchair_ratio=0.05, reduced_mobility_ratio=0.05),
    ]

    return ScenarioConfig(
        id="scenario_congested_corridor",
        name="Scenario B: Congested Central Corridor",
        description="High crowd concentration (200 agents) creating extreme hallway bottleneck crush. Tests predictive congestion diversion through parallel peripheral wings.",
        building=building,
        hazard_sources=[],
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=200,
        default_seed=202,
    )


def build_scenario_c_spreading_smoke() -> ScenarioConfig:
    """
    Scenario C: Spreading Smoke Near Preferred Exit
    A major fire originates right outside Exit A (North Grand Portal).
    Baseline greedily marches directly into toxic smoke because Exit A is shortest distance.
    EXIT-ZERO evaluates hazard cost H(P) and diverts agents to West Ramp and East exits safely.
    """
    floor = create_standard_hq_floor("floor_c")
    building = Building(id="bldg_hq_c", name="Apex Innovation HQ (Scenario C)", description="Spreading smoke hazard demonstration", floors=[floor])

    hazard = HazardSource(
        id="fire_north_lobby",
        floor_id="floor_c",
        x=40.0,
        y=8.0,
        hazard_type=HazardType.SMOKE,
        start_time_sec=5.0,
        growth_rate=0.25,
        max_radius=22.0,
        intensity=1.0,
    )

    spawn_zones = [
        SpawnZone(id="sp_boardroom", floor_id="floor_c", name="Boardrooms & North Suites", bounds=BoundingBox(x=10.0, y=6.0, width=55.0, height=8.0), occupant_count=60, wheelchair_ratio=0.06, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_central", floor_id="floor_c", name="Central Offices", bounds=BoundingBox(x=15.0, y=20.0, width=50.0, height=8.0), occupant_count=60, wheelchair_ratio=0.08, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_south", floor_id="floor_c", name="South Suites", bounds=BoundingBox(x=10.0, y=32.0, width=55.0, height=8.0), occupant_count=40, wheelchair_ratio=0.06, reduced_mobility_ratio=0.12),
    ]

    return ScenarioConfig(
        id="scenario_spreading_smoke",
        name="Scenario C: Spreading Smoke Near Preferred Exit",
        description="Smoke spreads rapidly near the main northern portal. Tests predictive hazard avoidance preventing severe exposure dosage compared to shortest-path.",
        building=building,
        hazard_sources=[hazard],
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=160,
        default_seed=303,
    )


def build_scenario_d_mixed_mobility() -> ScenarioConfig:
    """
    Scenario D: Mixed Mobility Population with Restricted Stair Access
    High proportion of wheelchair and reduced speed occupants (25%).
    Exit C (South) is a stairwell exit (non-wheelchair accessible).
    Baseline routes South occupants to nearest Exit C, resulting in trapped wheelchair users at the stairhead.
    EXIT-ZERO recognizes mobility constraints and guides wheelchair occupants along step-free ramps to West Exit D.
    """
    floor = create_standard_hq_floor("floor_d")
    building = Building(id="bldg_hq_d", name="Apex Innovation HQ (Scenario D)", description="Accessibility-aware routing demonstration", floors=[floor])

    spawn_zones = [
        SpawnZone(id="sp_south_mixed", floor_id="floor_d", name="South Operations", bounds=BoundingBox(x=8.0, y=30.0, width=55.0, height=10.0), occupant_count=80, wheelchair_ratio=0.25, reduced_mobility_ratio=0.15),
        SpawnZone(id="sp_hub_mixed", floor_id="floor_d", name="Atrium Crowd", bounds=BoundingBox(x=25.0, y=18.0, width=30.0, height=8.0), occupant_count=60, wheelchair_ratio=0.20, reduced_mobility_ratio=0.10),
    ]

    return ScenarioConfig(
        id="scenario_mixed_mobility",
        name="Scenario D: Mixed Mobility with Restricted Stair Access",
        description="High proportion (25%) of wheelchair users near a non-accessible stair exit. Demonstrates strict accessibility constraints and accessible route allocation.",
        building=building,
        hazard_sources=[],
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=140,
        default_seed=404,
    )


def build_university_hall_scenario() -> ScenarioConfig:
    """Scenario 2: University Science Concourse."""
    floor = Floor(
        id="floor_concourse",
        name="Level 1 Science Concourse",
        level=1,
        width=90.0,
        height=55.0,
        rooms=[
            Room(id="hall_alpha", floor_id="floor_concourse", name="Grand Lecture Hall Alpha", bounds=BoundingBox(x=8.0, y=6.0, width=32.0, height=18.0), room_type=RoomType.CONFERENCE, max_capacity=120),
            Room(id="lab_nano", floor_id="floor_concourse", name="Nanotech Cleanroom", bounds=BoundingBox(x=46.0, y=6.0, width=20.0, height=18.0), room_type=RoomType.LAB, max_capacity=30),
            Room(id="lab_chem", floor_id="floor_concourse", name="Materials Chemistry Suite", bounds=BoundingBox(x=70.0, y=6.0, width=15.0, height=18.0), room_type=RoomType.LAB, max_capacity=20),
            Room(id="commons", floor_id="floor_concourse", name="Student Commons & Study Lounge", bounds=BoundingBox(x=8.0, y=32.0, width=40.0, height=16.0), room_type=RoomType.CAFETERIA, max_capacity=80),
            Room(id="faculty", floor_id="floor_concourse", name="Faculty Offices & Administration", bounds=BoundingBox(x=54.0, y=32.0, width=30.0, height=16.0), room_type=RoomType.OFFICE, max_capacity=40),
        ],
        doorways=[
            Doorway(id="door_hall_1", floor_id="floor_concourse", x=16.0, y=24.0, width=2.0, connects_rooms=["hall_alpha"]),
            Doorway(id="door_hall_2", floor_id="floor_concourse", x=32.0, y=24.0, width=2.0, connects_rooms=["hall_alpha"]),
            Doorway(id="door_nano", floor_id="floor_concourse", x=56.0, y=24.0, width=1.5, connects_rooms=["lab_nano"]),
            Doorway(id="door_chem", floor_id="floor_concourse", x=77.0, y=24.0, width=1.5, connects_rooms=["lab_chem"]),
            Doorway(id="door_commons_1", floor_id="floor_concourse", x=18.0, y=32.0, width=2.4, connects_rooms=["commons"]),
            Doorway(id="door_commons_2", floor_id="floor_concourse", x=36.0, y=32.0, width=2.4, connects_rooms=["commons"]),
            Doorway(id="door_faculty", floor_id="floor_concourse", x=68.0, y=32.0, width=1.8, connects_rooms=["faculty"]),
        ],
        obstacles=[
            Obstacle(id="info_kiosk", floor_id="floor_concourse", x=44.0, y=27.0, width=3.0, height=2.0, obstacle_type=ObstacleType.FURNITURE),
        ],
        exits=[
            Exit(id="exit_concourse_west", floor_id="floor_concourse", name="West Campus Plaza Exit", x=3.0, y=27.5, width=3.5, throughput_per_sec=3.8, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_concourse_east", floor_id="floor_concourse", name="East Courtyard Exit", x=87.0, y=27.5, width=3.0, throughput_per_sec=3.2, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_concourse_south", floor_id="floor_concourse", name="South Transit Link Exit", x=45.0, y=52.0, width=2.5, throughput_per_sec=2.8, is_wheelchair_accessible=False, is_blocked=False),
        ],
        stairwells=[]
    )

    hazard = HazardSource(
        id="chem_spill_fire",
        floor_id="floor_concourse",
        x=75.0,
        y=12.0,
        hazard_type=HazardType.SMOKE,
        start_time_sec=10.0,
        growth_rate=0.22,
        max_radius=22.0,
        intensity=0.9,
    )

    spawn_zones = [
        SpawnZone(id="sp_hall", floor_id="floor_concourse", name="Lecture Hall Alpha", bounds=BoundingBox(x=10.0, y=8.0, width=28.0, height=14.0), occupant_count=120, wheelchair_ratio=0.08, reduced_mobility_ratio=0.08),
        SpawnZone(id="sp_commons", floor_id="floor_concourse", name="Student Commons", bounds=BoundingBox(x=10.0, y=34.0, width=36.0, height=12.0), occupant_count=70, wheelchair_ratio=0.06, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_labs", floor_id="floor_concourse", name="Labs & Faculty", bounds=BoundingBox(x=48.0, y=8.0, width=35.0, height=14.0), occupant_count=60, wheelchair_ratio=0.05, reduced_mobility_ratio=0.05),
    ]

    return ScenarioConfig(
        id="scenario_university_concourse",
        name="University Science Concourse: High-Density Egress",
        description="High-density scenario with 250 occupants flowing from a major auditorium and science labs.",
        building=Building(id="bldg_univ", name="Science Complex", description="Multi-department academic building", floors=[floor]),
        hazard_sources=[hazard],
        spawn_zones=spawn_zones,
        total_occupants=250,
        default_seed=101,
    )


def build_combined_emergency_scenario() -> ScenarioConfig:
    """
    Scenario 6: Combined Complex Emergency
    Severe compound multi-threat test:
    - Electrical fire originates in North corridor at t=5.0s, propagating rapidly.
    - East Fire Escape collapses and blocks at t=15.0s.
    - High proportion (20%) of wheelchair users near non-accessible South stair exit.
    Tests simultaneous congestion balancing, smoke avoidance, failure recovery, and hard accessibility constraints.
    """
    floor = create_standard_hq_floor("floor_comb")
    building = Building(id="bldg_hq_comb", name="Apex Innovation HQ (Combined Emergency)", description="Compound multi-threat evacuation challenge", floors=[floor])

    hazard = HazardSource(
        id="fire_north_hall",
        floor_id="floor_comb",
        x=40.0,
        y=8.0,
        hazard_type=HazardType.FIRE,
        start_time_sec=5.0,
        growth_rate=0.22,
        max_radius=20.0,
        intensity=1.0,
    )

    events = [
        ScenarioEvent(
            time_sec=15.0,
            event_type=ScenarioEventType.BLOCK_EXIT,
            target_id="exit_east_fire",
            description="East Fire Escape collapsed by secondary explosion.",
        )
    ]

    spawn_zones = [
        SpawnZone(id="sp_comb_north", floor_id="floor_comb", name="North Wing Staff", bounds=BoundingBox(x=10.0, y=6.0, width=50.0, height=8.0), occupant_count=60, wheelchair_ratio=0.15, reduced_mobility_ratio=0.10),
        SpawnZone(id="sp_comb_hub", floor_id="floor_comb", name="Atrium & Dining Crowd", bounds=BoundingBox(x=25.0, y=18.0, width=30.0, height=8.0), occupant_count=70, wheelchair_ratio=0.20, reduced_mobility_ratio=0.15),
        SpawnZone(id="sp_comb_south", floor_id="floor_comb", name="South Operations", bounds=BoundingBox(x=10.0, y=31.0, width=50.0, height=8.0), occupant_count=50, wheelchair_ratio=0.25, reduced_mobility_ratio=0.15),
    ]

    return ScenarioConfig(
        id="scenario_combined_emergency",
        name="Scenario 6: Combined Complex Emergency",
        description="Compound hazard scenario with active fire spreading across northern corridor, sudden exit closure of East Fire Escape at t=15s, and 20% wheelchair accessibility requirement.",
        building=building,
        hazard_sources=[hazard],
        spawn_zones=spawn_zones,
        events=events,
        total_occupants=180,
        default_seed=505,
    )


def build_multifloor_demo_scenario() -> ScenarioConfig:
    """
    Scenario 7: EXIT-ZERO Multi-Floor Digital Twin Demo
    3-floor healthcare & administration facility digital twin:
      - F1: Lobby & Reception, Triage, Outpatient, 4 ground exits, 2 stairwells, 1 accessible ramp.
      - F2: General Ward with Patient Rooms R-201 to R-208, ICU, 2 stair landings, 1 ramp landing.
      - F3: Executive Administration, Boardrooms, IT & Server Hub with active hazard smoke/fire.
    Total: 28 rooms, 12 corridors, 4 exits, 2 stairs, 1 ramp, capacity 720 occupants.
    Demonstrates true 3D multi-floor agent navigation with wheelchair accessibility routing.
    """
    # Floor 1: Lobby & Ground Exits
    floor_1 = Floor(
        id="floor_1",
        name="F1 - Lobby & Exits",
        level=1,
        elevation=0.0,
        floor_height=3.2,
        width=80.0,
        height=45.0,
        rooms=[
            Room(id="R-101", floor_id="floor_1", name="Lobby & Reception", bounds=BoundingBox(x=5.0, y=5.0, width=14.0, height=10.0), room_type=RoomType.LOBBY, max_capacity=30),
            Room(id="R-102", floor_id="floor_1", name="Triage & Intake", bounds=BoundingBox(x=21.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=20),
            Room(id="R-103", floor_id="floor_1", name="Central Waiting Lounge", bounds=BoundingBox(x=35.0, y=5.0, width=16.0, height=10.0), room_type=RoomType.CAFETERIA, max_capacity=35),
            Room(id="R-104", floor_id="floor_1", name="Security & Dispatch", bounds=BoundingBox(x=53.0, y=5.0, width=11.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=15),
            Room(id="R-105", floor_id="floor_1", name="Facilities Depot", bounds=BoundingBox(x=66.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.STORAGE, max_capacity=10),
            Room(id="R-106", floor_id="floor_1", name="Pharmacy Dispensary", bounds=BoundingBox(x=5.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.LAB, max_capacity=20),
            Room(id="R-107", floor_id="floor_1", name="Records Archive", bounds=BoundingBox(x=21.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.STORAGE, max_capacity=15),
            Room(id="R-108", floor_id="floor_1", name="Outpatient Clinic A", bounds=BoundingBox(x=35.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=25),
            Room(id="R-109", floor_id="floor_1", name="Restrooms & First Aid", bounds=BoundingBox(x=51.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.RESTROOM, max_capacity=15),
        ],
        doorways=[
            Doorway(id="D-101", floor_id="floor_1", x=12.0, y=15.0, width=1.4, connects_rooms=["R-101"]),
            Doorway(id="D-102", floor_id="floor_1", x=27.0, y=15.0, width=1.2, connects_rooms=["R-102"]),
            Doorway(id="D-103", floor_id="floor_1", x=43.0, y=15.0, width=2.0, connects_rooms=["R-103"]),
            Doorway(id="D-104", floor_id="floor_1", x=58.0, y=15.0, width=1.2, connects_rooms=["R-104"]),
            Doorway(id="D-105", floor_id="floor_1", x=71.0, y=15.0, width=1.1, connects_rooms=["R-105"]),
            Doorway(id="D-106", floor_id="floor_1", x=12.0, y=30.0, width=1.3, connects_rooms=["R-106"]),
            Doorway(id="D-107", floor_id="floor_1", x=27.0, y=30.0, width=1.2, connects_rooms=["R-107"]),
            Doorway(id="D-108", floor_id="floor_1", x=42.0, y=30.0, width=1.5, connects_rooms=["R-108"]),
            Doorway(id="D-109", floor_id="floor_1", x=57.0, y=30.0, width=1.2, connects_rooms=["R-109"]),
        ],
        exits=[
            Exit(id="exit_north_main", floor_id="floor_1", name="Exit A: North Grand Portal", x=40.0, y=2.0, width=3.2, throughput_per_sec=3.2, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_east_fire", floor_id="floor_1", name="Exit B: East Fire Escape", x=77.0, y=22.5, width=2.0, throughput_per_sec=2.2, is_wheelchair_accessible=True, is_blocked=False),
            Exit(id="exit_south_stair", floor_id="floor_1", name="Exit C: South Stair Exit", x=40.0, y=43.0, width=2.0, throughput_per_sec=1.8, is_wheelchair_accessible=False, is_blocked=False),
            Exit(id="exit_west_ramp", floor_id="floor_1", name="Exit D: West Accessible Ramp", x=3.0, y=22.5, width=2.8, throughput_per_sec=2.8, is_wheelchair_accessible=True, is_blocked=False),
        ],
        stairwells=[
            Stairwell(id="stair_east_1_2", from_floor="floor_1", to_floor="floor_2", x=68.0, y=22.5, width=1.8, throughput_per_sec=1.8, is_wheelchair_accessible=False),
            Stairwell(id="stair_west_1_2", from_floor="floor_1", to_floor="floor_2", x=12.0, y=22.5, width=1.8, throughput_per_sec=1.8, is_wheelchair_accessible=False),
            Stairwell(id="ramp_central_1_2", from_floor="floor_1", to_floor="floor_2", x=40.0, y=22.5, width=2.4, throughput_per_sec=2.4, is_wheelchair_accessible=True, is_ramp=True),
        ]
    )

    # Floor 2: General Ward
    floor_2 = Floor(
        id="floor_2",
        name="F2 - General Ward",
        level=2,
        elevation=3.2,
        floor_height=3.2,
        width=80.0,
        height=45.0,
        rooms=[
            Room(id="R-201", floor_id="floor_2", name="Patient Room 201", bounds=BoundingBox(x=5.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=6),
            Room(id="R-202", floor_id="floor_2", name="Patient Room 202", bounds=BoundingBox(x=17.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=6),
            Room(id="R-203", floor_id="floor_2", name="Patient Room 203", bounds=BoundingBox(x=29.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=6),
            Room(id="R-204", floor_id="floor_2", name="Patient Room 204", bounds=BoundingBox(x=41.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=6),
            Room(id="R-205", floor_id="floor_2", name="Nurse Station & Monitoring", bounds=BoundingBox(x=53.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=20),
            Room(id="R-206", floor_id="floor_2", name="Treatment Room 206", bounds=BoundingBox(x=67.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.LAB, max_capacity=10),
            Room(id="R-207", floor_id="floor_2", name="Patient Room 207", bounds=BoundingBox(x=5.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=8),
            Room(id="R-208", floor_id="floor_2", name="Patient Room 208", bounds=BoundingBox(x=19.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=8),
            Room(id="R-209", floor_id="floor_2", name="Intensive Care Unit", bounds=BoundingBox(x=33.0, y=30.0, width=16.0, height=10.0), room_type=RoomType.LAB, max_capacity=25),
            Room(id="R-210", floor_id="floor_2", name="Staff Rest & Consultation", bounds=BoundingBox(x=51.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.CONFERENCE, max_capacity=20),
        ],
        doorways=[
            Doorway(id="D-201", floor_id="floor_2", x=10.0, y=15.0, width=1.2, connects_rooms=["R-201"]),
            Doorway(id="D-202", floor_id="floor_2", x=22.0, y=15.0, width=1.2, connects_rooms=["R-202"]),
            Doorway(id="D-203", floor_id="floor_2", x=34.0, y=15.0, width=1.2, connects_rooms=["R-203"]),
            Doorway(id="D-204", floor_id="floor_2", x=46.0, y=15.0, width=1.4, connects_rooms=["R-204"]),
            Doorway(id="D-205", floor_id="floor_2", x=59.0, y=15.0, width=1.8, connects_rooms=["R-205"]),
            Doorway(id="D-206", floor_id="floor_2", x=72.0, y=15.0, width=1.2, connects_rooms=["R-206"]),
            Doorway(id="D-207", floor_id="floor_2", x=11.0, y=30.0, width=1.2, connects_rooms=["R-207"]),
            Doorway(id="D-208", floor_id="floor_2", x=25.0, y=30.0, width=1.2, connects_rooms=["R-208"]),
            Doorway(id="D-209", floor_id="floor_2", x=41.0, y=30.0, width=1.8, connects_rooms=["R-209"]),
            Doorway(id="D-210", floor_id="floor_2", x=58.0, y=30.0, width=1.4, connects_rooms=["R-210"]),
        ],
        exits=[],
        stairwells=[
            Stairwell(id="stair_east_2_3", from_floor="floor_2", to_floor="floor_3", x=68.0, y=22.5, width=1.8, throughput_per_sec=1.8, is_wheelchair_accessible=False),
            Stairwell(id="stair_west_2_3", from_floor="floor_2", to_floor="floor_3", x=12.0, y=22.5, width=1.8, throughput_per_sec=1.8, is_wheelchair_accessible=False),
            Stairwell(id="ramp_central_2_3", from_floor="floor_2", to_floor="floor_3", x=40.0, y=22.5, width=2.4, throughput_per_sec=2.4, is_wheelchair_accessible=True, is_ramp=True),
        ]
    )

    # Floor 3: Administration
    floor_3 = Floor(
        id="floor_3",
        name="F3 - Administration",
        level=3,
        elevation=6.4,
        floor_height=3.2,
        width=80.0,
        height=45.0,
        rooms=[
            Room(id="R-301", floor_id="floor_3", name="Executive Boardroom", bounds=BoundingBox(x=5.0, y=5.0, width=14.0, height=10.0), room_type=RoomType.CONFERENCE, max_capacity=25),
            Room(id="R-302", floor_id="floor_3", name="Dean & Director Suite", bounds=BoundingBox(x=21.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=15),
            Room(id="R-303", floor_id="floor_3", name="Finance & Operations", bounds=BoundingBox(x=35.0, y=5.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=15),
            Room(id="R-304", floor_id="floor_3", name="IT & Data Science Hub", bounds=BoundingBox(x=49.0, y=5.0, width=14.0, height=10.0), room_type=RoomType.LAB, max_capacity=20),
            Room(id="R-305", floor_id="floor_3", name="Telecom & Server Rack", bounds=BoundingBox(x=65.0, y=5.0, width=10.0, height=10.0), room_type=RoomType.STORAGE, max_capacity=8),
            Room(id="R-306", floor_id="floor_3", name="Human Resources 306", bounds=BoundingBox(x=5.0, y=30.0, width=14.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=16),
            Room(id="R-307", floor_id="floor_3", name="Legal Counsel Office", bounds=BoundingBox(x=21.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.OFFICE, max_capacity=12),
            Room(id="R-308", floor_id="floor_3", name="Faculty Conference B", bounds=BoundingBox(x=35.0, y=30.0, width=16.0, height=10.0), room_type=RoomType.CONFERENCE, max_capacity=25),
            Room(id="R-309", floor_id="floor_3", name="Administration Restrooms", bounds=BoundingBox(x=53.0, y=30.0, width=12.0, height=10.0), room_type=RoomType.RESTROOM, max_capacity=15),
        ],
        doorways=[
            Doorway(id="D-301", floor_id="floor_3", x=12.0, y=15.0, width=1.4, connects_rooms=["R-301"]),
            Doorway(id="D-302", floor_id="floor_3", x=27.0, y=15.0, width=1.2, connects_rooms=["R-302"]),
            Doorway(id="D-303", floor_id="floor_3", x=41.0, y=15.0, width=1.2, connects_rooms=["R-303"]),
            Doorway(id="D-304", floor_id="floor_3", x=56.0, y=15.0, width=1.4, connects_rooms=["R-304"]),
            Doorway(id="D-305", floor_id="floor_3", x=70.0, y=15.0, width=1.1, connects_rooms=["R-305"]),
            Doorway(id="D-306", floor_id="floor_3", x=12.0, y=30.0, width=1.3, connects_rooms=["R-306"]),
            Doorway(id="D-307", floor_id="floor_3", x=27.0, y=30.0, width=1.2, connects_rooms=["R-307"]),
            Doorway(id="D-308", floor_id="floor_3", x=43.0, y=30.0, width=1.6, connects_rooms=["R-308"]),
            Doorway(id="D-309", floor_id="floor_3", x=59.0, y=30.0, width=1.2, connects_rooms=["R-309"]),
        ],
        exits=[],
        stairwells=[]
    )

    building = Building(
        id="bldg_multifloor_demo",
        name="EXIT-ZERO Multi-Floor Demo",
        description="High-fidelity 3-floor healthcare facility digital twin featuring Lobby, Inpatient Ward, and Executive Administration.",
        author="EXIT-ZERO Digital Twin Platform",
        version="2.0",
        floors=[floor_1, floor_2, floor_3]
    )

    hazards = [
        HazardSource(
            id="fire_f3_server",
            floor_id="floor_3",
            x=68.0,
            y=8.0,
            hazard_type=HazardType.FIRE,
            start_time_sec=8.0,
            growth_rate=0.18,
            max_radius=14.0,
            intensity=0.9,
        )
    ]

    spawn_zones = [
        SpawnZone(id="sp_f1_lobby", floor_id="floor_1", name="F1 Lobby & Outpatient Crowd", bounds=BoundingBox(x=10.0, y=6.0, width=45.0, height=8.0), occupant_count=40, wheelchair_ratio=0.10, reduced_mobility_ratio=0.15),
        SpawnZone(id="sp_f2_ward", floor_id="floor_2", name="F2 Ward Patients & Nursing Staff", bounds=BoundingBox(x=10.0, y=6.0, width=45.0, height=8.0), occupant_count=50, wheelchair_ratio=0.20, reduced_mobility_ratio=0.20),
        SpawnZone(id="sp_f3_admin", floor_id="floor_3", name="F3 Executive Administration", bounds=BoundingBox(x=10.0, y=6.0, width=45.0, height=8.0), occupant_count=50, wheelchair_ratio=0.10, reduced_mobility_ratio=0.10),
    ]

    return ScenarioConfig(
        id="scenario_multifloor_demo",
        name="EXIT-ZERO Multi-Floor Demo",
        description="Comprehensive 3-floor digital twin demonstration with multi-floor vertical egress, accessible ramps, stairwells, and predictive evacuation routing.",
        building=building,
        hazard_sources=hazards,
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=140,
        default_seed=42,
    )


SCENARIO_REGISTRY: Dict[str, ScenarioConfig] = {
    "scenario_multifloor_demo": build_multifloor_demo_scenario(),
    "scenario_normal_evacuation": build_normal_evacuation_scenario(),
    "scenario_sudden_exit_closure": build_scenario_a_sudden_exit_closure(),
    "scenario_congested_corridor": build_scenario_b_congested_corridor(),
    "scenario_spreading_smoke": build_scenario_c_spreading_smoke(),
    "scenario_mixed_mobility": build_scenario_d_mixed_mobility(),
    "scenario_combined_emergency": build_combined_emergency_scenario(),
    "scenario_hq_floor1": build_hq_scenario(),
    "scenario_university_concourse": build_university_hall_scenario(),
}


def list_scenarios() -> List[ScenarioSummary]:
    summaries: List[ScenarioSummary] = []
    for sc in SCENARIO_REGISTRY.values():
        total_rooms = sum(len(f.rooms) for f in sc.building.floors)
        total_exits = sum(len(f.exits) for f in sc.building.floors)
        summaries.append(
            ScenarioSummary(
                id=sc.id,
                name=sc.name,
                description=sc.description,
                floor_count=len(sc.building.floors),
                room_count=total_rooms,
                exit_count=total_exits,
                total_occupants=sc.total_occupants,
                hazard_source_count=len(sc.hazard_sources),
                event_count=len(sc.events),
            )
        )
    return summaries


def get_scenario(scenario_id: str) -> ScenarioConfig:
    if scenario_id not in SCENARIO_REGISTRY:
        raise KeyError(f"Scenario '{scenario_id}' not found. Available: {list(SCENARIO_REGISTRY.keys())}")
    return SCENARIO_REGISTRY[scenario_id]


def export_scenarios_to_disk(base_dir: str = "scenarios"):
    os.makedirs(base_dir, exist_ok=True)
    for s_id, sc in SCENARIO_REGISTRY.items():
        file_path = os.path.join(base_dir, f"{s_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sc.model_dump_json(indent=2))
