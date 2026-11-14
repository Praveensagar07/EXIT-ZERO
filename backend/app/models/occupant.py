from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class MobilityCategory(str, Enum):
    STANDARD = "standard"
    WHEELCHAIR = "wheelchair"
    REDUCED_SPEED = "reduced_speed"


class EvacuationState(str, Enum):
    UNASSIGNED = "unassigned"
    EVACUATING = "evacuating"
    WAITING = "waiting"
    EXITED = "exited"
    TRAPPED = "trapped"


class Occupant(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    z: float = 0.0
    current_node_id: str
    target_exit_id: Optional[str] = None
    movement_speed: float = 1.35   # current speed in m/s
    free_speed: float = 1.35       # unimpeded speed in m/s
    mobility_category: MobilityCategory = MobilityCategory.STANDARD
    evacuation_state: EvacuationState = EvacuationState.EVACUATING
    hazard_exposure: float = 0.0   # cumulative dosage index [0, inf)
    current_path: List[str] = Field(default_factory=list) # ordered sequence of node IDs
    previous_path: List[str] = Field(default_factory=list) # previous path before replanning
    path_index: int = 0
    distance_traveled: float = 0.0 # meters traveled so far
    waiting_time_sec: float = 0.0  # seconds spent waiting in queues
    current_edge_id: Optional[str] = None # edge currently being traversed (e.g. "u_v")
    last_replan_time_sec: float = 0.0 # timestamp of last route recalculation
    current_route_cost: float = 0.0 # total objective score J(P)
    evacuation_time_sec: Optional[float] = None
    reroute_count: int = 0
