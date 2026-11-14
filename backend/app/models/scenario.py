from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.building import Building, HazardSource, SpawnZone


class AlgorithmType(str, Enum):
    BASELINE = "baseline"
    ADAPTIVE = "adaptive"


class ScenarioEventType(str, Enum):
    BLOCK_EXIT = "block_exit"
    UNBLOCK_EXIT = "unblock_exit"
    BLOCK_CORRIDOR = "block_corridor"
    UNBLOCK_CORRIDOR = "unblock_corridor"
    ACTIVATE_HAZARD = "activate_hazard"


class ScenarioEvent(BaseModel):
    time_sec: float
    event_type: ScenarioEventType
    target_id: str                      # exit_id, hazard_id, or node_u
    secondary_target_id: Optional[str] = None # node_v for corridor blocking
    description: str = ""


class AlgorithmWeights(BaseModel):
    w_distance: float = 1.0            # Travel distance / time weight
    w_congestion: float = 2.0          # Corridor crowd congestion penalty weight
    w_queue: float = 2.5               # Exit bottleneck queue delay weight
    w_hazard: float = 8.0              # Smoke/fire hazard exposure penalty weight
    w_reroute: float = 5.0             # Route switching penalty (hysteresis)
    w_accessibility: float = 1000.0    # Hard constraint barrier weight for inaccessible paths
    w_accessibility_reservation: float = 0.0 # Optional penalty (off by default to avoid stair funneling); configurable > 0
    hysteresis_threshold: float = 0.20  # Alternative route must be >= 20% superior to switch
    replan_interval_sec: float = 4.0   # Replanning cadence interval in seconds
    prediction_horizon_sec: float = 20.0 # Predictive inflow lookahead horizon in seconds


class ScenarioConfig(BaseModel):
    id: str
    name: str
    description: str
    building: Building
    hazard_sources: List[HazardSource] = Field(default_factory=list)
    spawn_zones: List[SpawnZone] = Field(default_factory=list)
    events: List[ScenarioEvent] = Field(default_factory=list)
    total_occupants: int = 150
    default_seed: int = 42
    algorithm_weights: AlgorithmWeights = Field(default_factory=AlgorithmWeights)


class ScenarioSummary(BaseModel):
    id: str
    name: str
    description: str
    floor_count: int
    room_count: int
    exit_count: int
    total_occupants: int
    hazard_source_count: int
    event_count: int = 0
