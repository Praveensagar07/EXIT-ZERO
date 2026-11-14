from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    ROOM_CENTER = "room_center"
    DOORWAY = "doorway"
    CORRIDOR_JUNCTION = "corridor_junction"
    CORRIDOR_WAYPOINT = "corridor_waypoint"
    EXIT = "exit"
    STAIRWELL = "stairwell"


class GraphNode(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    node_type: NodeType
    room_id: Optional[str] = None
    is_accessible: bool = True  # True if wheelchair-accessible
    label: Optional[str] = None
    queue_length: int = 0       # Current number of occupants queued at this node


class GraphEdge(BaseModel):
    u: str
    v: str
    length: float                  # Euclidean distance in meters
    width: float = 1.8             # Width in meters
    capacity_per_sec: float = 2.4  # Max egress throughput (persons/sec)
    wheelchair_accessible: bool = True
    hazard_level: float = 0.0      # Current edge danger index [0.0, 1.0]
    current_occupants: int = 0     # Number of occupants currently on or queuing for edge
    current_density: float = 0.0   # Current crowd density in persons/m^2
    base_weight: float             # Initial traversal cost (defaulting to length)


class NavigationGraphModel(BaseModel):
    nodes: Dict[str, GraphNode] = Field(default_factory=dict)
    edges: List[GraphEdge] = Field(default_factory=list)
