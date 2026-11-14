from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class RoomType(str, Enum):
    OFFICE = "office"
    CONFERENCE = "conference"
    LOBBY = "lobby"
    RESTROOM = "restroom"
    LAB = "lab"
    CAFETERIA = "cafeteria"
    STORAGE = "storage"
    CORRIDOR = "corridor"


class ObstacleType(str, Enum):
    WALL = "wall"
    COLUMN = "column"
    FURNITURE = "furniture"
    DEBRIS = "debris"


class HazardType(str, Enum):
    FIRE = "fire"
    SMOKE = "smoke"
    STRUCTURAL = "structural"


class Point2D(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Doorway(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    width: float = 1.2  # meters
    connects_rooms: List[str] = Field(default_factory=list)
    is_open: bool = True
    is_emergency_exit: bool = False


class Obstacle(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    width: float
    height: float
    obstacle_type: ObstacleType = ObstacleType.WALL
    passable: bool = False


class Exit(BaseModel):
    id: str
    floor_id: str
    name: str
    x: float
    y: float
    width: float = 1.8  # meters
    throughput_per_sec: float = 2.0  # max persons passing through per second
    is_wheelchair_accessible: bool = True
    is_blocked: bool = False
    current_queue: int = 0
    total_exited: int = 0


class Stairwell(BaseModel):
    id: str
    from_floor: str
    to_floor: str
    x: float
    y: float
    width: float = 1.5
    throughput_per_sec: float = 1.5
    is_wheelchair_accessible: bool = False
    is_ramp: bool = False
    target_x: Optional[float] = None
    target_y: Optional[float] = None


class Room(BaseModel):
    id: str
    floor_id: str
    name: str
    bounds: BoundingBox
    room_type: RoomType = RoomType.OFFICE
    max_capacity: int = 25
    height: float = 3.2
    is_accessible: bool = True


class HazardSource(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    hazard_type: HazardType = HazardType.FIRE
    start_time_sec: float = 0.0
    growth_rate: float = 0.15  # radius growth per second
    max_radius: float = 15.0   # meters
    intensity: float = 1.0     # 0.0 to 1.0 peak severity


class SpawnZone(BaseModel):
    id: str
    floor_id: str
    name: str
    bounds: BoundingBox
    occupant_count: int = 20
    wheelchair_ratio: float = 0.08       # 8% wheelchair accessible requirements
    reduced_mobility_ratio: float = 0.12 # 12% reduced speed (elderly, injured)


class Floor(BaseModel):
    id: str
    name: str
    level: int = 1
    elevation: float = 0.0      # vertical elevation in meters (z)
    floor_height: float = 3.2   # floor to ceiling height in meters
    width: float = 80.0         # meters
    height: float = 50.0        # meters
    rooms: List[Room] = Field(default_factory=list)
    doorways: List[Doorway] = Field(default_factory=list)
    obstacles: List[Obstacle] = Field(default_factory=list)
    exits: List[Exit] = Field(default_factory=list)
    stairwells: List[Stairwell] = Field(default_factory=list)


class Building(BaseModel):
    id: str
    name: str
    description: str
    author: Optional[str] = "EXIT-ZERO Studio"
    version: str = "1.0"
    floors: List[Floor] = Field(default_factory=list)
