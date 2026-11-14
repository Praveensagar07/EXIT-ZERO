from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.graph import NavigationGraphModel
from app.models.occupant import Occupant
from app.models.building import Exit, HazardSource
from app.models.scenario import AlgorithmType, AlgorithmWeights


class SimulationStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


class RerouteEvent(BaseModel):
    time_sec: float
    occupant_id: str
    previous_exit_id: Optional[str] = None
    new_exit_id: str
    reason: str                        # e.g., "EXIT_BLOCKED", "HAZARD_SPREAD", "CONGESTION_ADVANTAGE"
    cost_improvement_percent: float = 0.0


class RouteCostBreakdown(BaseModel):
    travel_time_sec: float
    queue_delay_sec: float
    hazard_penalty_sec: float
    congestion_penalty_sec: float
    reroute_penalty_sec: float
    total_cost: float


class SimulationMetrics(BaseModel):
    total_evacuated: int = 0
    total_occupants: int = 0
    completion_percentage: float = 0.0
    elapsed_time_sec: float = 0.0
    total_evacuation_time_sec: Optional[float] = None
    median_evacuation_time_sec: Optional[float] = None
    p95_evacuation_time_sec: Optional[float] = None
    mean_crowd_density: float = 0.0        # mean density across occupied corridors (pers/m^2)
    max_crowd_density: float = 0.0         # peak local crowd density observed (pers/m^2)
    current_exit_queue_length: int = 0     # active occupants waiting in exit queues
    max_exit_queue_length: int = 0         # peak queue observed at any exit
    mean_occupant_speed: float = 0.0       # mean current walking speed of moving occupants (m/s)
    current_exit_throughput: float = 0.0   # instantaneous throughput across all exits (pers/sec)
    mean_waiting_time_sec: float = 0.0     # mean time spent waiting in queues
    trapped_occupants: int = 0
    wheelchair_unreachable_count: int = 0
    wheelchair_occupant_count: int = 0
    wheelchair_evacuated_count: int = 0
    wheelchair_completion_percentage: float = 0.0
    mean_wheelchair_evacuation_time_sec: Optional[float] = None
    p95_wheelchair_evacuation_time_sec: Optional[float] = None
    total_reroutes: int = 0                # total number of route adjustments performed
    unnecessary_reroutes: int = 0
    time_above_density_threshold_sec: float = 0.0 # time spent with corridors above severe threshold (3.0 pers/m^2)
    cumulative_hazard_exposure: float = 0.0       # aggregate hazard dosage across all occupants
    is_evacuation_complete: bool = False          # true only if 100% of occupants safely evacuated
    peak_memory_mb: float = 0.0                   # legacy field; experiment reports label the measurement explicitly
    simulation_execution_time_ms: float = 0.0


class SimulationInitRequest(BaseModel):
    scenario_id: str
    algorithm: AlgorithmType = AlgorithmType.BASELINE
    seed: int = 42
    occupant_count_override: Optional[int] = None
    algorithm_weights: Optional[AlgorithmWeights] = None


class SimulationStepRequest(BaseModel):
    steps: int = 1
    dt: float = 0.5  # delta time in seconds
    toggle_blocked_exit: Optional[str] = None # Interactive exit toggle from UI


class SimulationState(BaseModel):
    session_id: str
    scenario_id: str
    algorithm: AlgorithmType
    status: SimulationStatus = SimulationStatus.IDLE
    current_time_sec: float = 0.0
    step_count: int = 0
    seed: int
    graph: NavigationGraphModel
    occupants: List[Occupant] = Field(default_factory=list)
    exits: List[Exit] = Field(default_factory=list)
    hazards: List[HazardSource] = Field(default_factory=list)
    metrics: SimulationMetrics = Field(default_factory=SimulationMetrics)
    reroute_events: List[RerouteEvent] = Field(default_factory=list)
    executed_event_ids: List[str] = Field(default_factory=list)
