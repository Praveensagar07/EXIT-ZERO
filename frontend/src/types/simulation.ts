export type RoomType =
  | 'office'
  | 'conference'
  | 'lobby'
  | 'restroom'
  | 'lab'
  | 'cafeteria'
  | 'storage'
  | 'corridor';

export type ObstacleType = 'wall' | 'column' | 'furniture' | 'debris';
export type HazardType = 'fire' | 'smoke' | 'structural';
export type MobilityCategory = 'standard' | 'wheelchair' | 'reduced_speed';
export type EvacuationState = 'unassigned' | 'evacuating' | 'waiting' | 'exited' | 'trapped';
export type NodeType =
  | 'room_center'
  | 'doorway'
  | 'corridor_junction'
  | 'corridor_waypoint'
  | 'exit'
  | 'stairwell';
export type AlgorithmType = 'baseline' | 'adaptive';
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  bounds: BoundingBox;
  room_type: RoomType;
  max_capacity: number;
  height?: number;
  is_accessible?: boolean;
}

export interface Doorway {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  width: number;
  connects_rooms: string[];
  is_open: boolean;
  is_emergency_exit: boolean;
}

export interface Obstacle {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  obstacle_type: ObstacleType;
  passable: boolean;
}

export interface Exit {
  id: string;
  floor_id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  throughput_per_sec: number;
  is_wheelchair_accessible: boolean;
  is_blocked: boolean;
  current_queue?: number;
  total_exited?: number;
}

export interface Stairwell {
  id: string;
  from_floor: string;
  to_floor: string;
  x: number;
  y: number;
  width: number;
  throughput_per_sec: number;
  is_wheelchair_accessible: boolean;
  is_ramp?: boolean;
  target_x?: number;
  target_y?: number;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  elevation?: number;
  floor_height?: number;
  width: number;
  height: number;
  rooms: Room[];
  doorways: Doorway[];
  obstacles: Obstacle[];
  exits: Exit[];
  stairwells: Stairwell[];
}

export interface Building {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  floors: Floor[];
}

export interface BuildingSummary {
  id: string;
  name: string;
  description: string;
  floor_count: number;
  room_count: number;
  corridor_count: number;
  exit_count: number;
  stair_count: number;
  ramp_count: number;
  total_capacity: number;
  is_custom?: boolean;
}

export interface BuildingValidationReport {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
  audit?: TopologyAuditReport;
}

export interface HazardSource {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  hazard_type: HazardType;
  start_time_sec: number;
  growth_rate: number;
  max_radius: number;
  intensity: number;
  current_radius?: number;
  smoke_radius?: number;
  affected_room_id?: string;
  is_active?: boolean;
}

export interface SpawnZone {
  id: string;
  floor_id: string;
  name: string;
  bounds: BoundingBox;
  occupant_count: number;
  wheelchair_ratio: number;
  reduced_mobility_ratio: number;
}

export interface GraphNode {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  z?: number;
  node_type: NodeType;
  room_id?: string;
  is_accessible: boolean;
  label?: string;
  queue_length?: number;
}

export interface GraphEdge {
  u: string;
  v: string;
  length: number;
  width: number;
  capacity_per_sec: number;
  wheelchair_accessible: boolean;
  hazard_level: number;
  smoke_level?: number;
  is_impassable?: boolean;
  current_occupants: number;
  current_density?: number;
  base_weight: number;
}

export interface NavigationGraphModel {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

export interface RerouteEvent {
  time_sec: number;
  occupant_id: string;
  previous_exit_id?: string;
  new_exit_id: string;
  reason: string;
  cost_improvement_percent: number;
}

export interface RouteCostBreakdown {
  travel_time_sec: number;
  queue_delay_sec: number;
  hazard_penalty_sec: number;
  congestion_penalty_sec: number;
  reroute_penalty_sec: number;
  total_cost: number;
}

export interface AlgorithmWeights {
  w_distance: number;
  w_congestion: number;
  w_queue: number;
  w_hazard: number;
  w_reroute: number;
  w_accessibility: number;
  hysteresis_threshold: number;
  replan_interval_sec: number;
  prediction_horizon_sec: number;
}

export interface Occupant {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  z?: number;
  current_node_id: string;
  target_exit_id?: string;
  movement_speed: number;
  free_speed: number;
  mobility_category: MobilityCategory;
  evacuation_state: EvacuationState;
  hazard_exposure: number;
  current_path: string[];
  previous_path?: string[];
  path_index: number;
  distance_traveled: number;
  waiting_time_sec?: number;
  evacuation_time_sec?: number;
  last_replan_time_sec?: number;
  current_route_cost?: number;
  reroute_count: number;
}

export interface SimulationMetrics {
  total_evacuated: number;
  total_occupants: number;
  completion_percentage: number;
  elapsed_time_sec: number;
  total_evacuation_time_sec?: number;
  median_evacuation_time_sec?: number;
  p95_evacuation_time_sec?: number;
  mean_crowd_density?: number;
  max_crowd_density: number;
  current_exit_queue_length?: number;
  max_exit_queue_length: number;
  mean_occupant_speed?: number;
  current_exit_throughput?: number;
  mean_waiting_time_sec?: number;
  cumulative_hazard_exposure?: number;
  trapped_occupants: number;
  wheelchair_unreachable_count?: number;
  wheelchair_occupant_count?: number;
  wheelchair_evacuated_count?: number;
  wheelchair_completion_percentage?: number;
  mean_wheelchair_evacuation_time_sec?: number | null;
  p95_wheelchair_evacuation_time_sec?: number | null;
  total_reroutes?: number;
  unnecessary_reroutes: number;
  time_above_density_threshold_sec?: number;
  is_evacuation_complete?: boolean;
  peak_memory_mb?: number;
  simulation_execution_time_ms: number;
}

export interface SimulationState {
  session_id: string;
  scenario_id: string;
  algorithm: AlgorithmType;
  status: SimulationStatus;
  current_time_sec: number;
  step_count: number;
  seed: number;
  graph: NavigationGraphModel;
  occupants: Occupant[];
  exits: Exit[];
  hazards: HazardSource[];
  metrics: SimulationMetrics;
  reroute_events?: RerouteEvent[];
  executed_event_ids?: string[];
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  floor_count: number;
  room_count: number;
  exit_count: number;
  total_occupants: number;
  hazard_source_count: number;
}

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  building: Building;
  hazard_sources: HazardSource[];
  spawn_zones: SpawnZone[];
  total_occupants: number;
  default_seed: number;
}

export interface TopologyAuditReport {
  is_valid: boolean;
  total_nodes: number;
  total_edges: number;
  is_connected: boolean;
  connected_components_count: number;
  total_exits: number;
  accessible_exits_count: number;
  unreachable_rooms: string[];
  wheelchair_accessible_coverage_percent: number;
  unreachable_accessible_rooms: string[];
  average_edge_length_meters: number;
  room_shortest_exit_dists: Record<string, number>;
}

export interface ExperimentRunRequest {
  scenario_id: string;
  occupant_count: number;
  seeds: number[];
  max_sim_time_sec?: number;
  dt?: number;
}

export interface PairedTrialMetrics {
  seed: number;
  scenario_id: string;
  occupant_count: number;
  baseline_metrics: SimulationMetrics;
  adaptive_metrics: SimulationMetrics;
  diff_evacuation_time_sec?: number | null;
  relative_time_improvement_pct?: number | null;
  diff_median_time_sec?: number | null;
  diff_p95_time_sec?: number | null;
  diff_peak_density: number;
  diff_peak_queue: number;
  diff_waiting_time_sec: number;
  diff_hazard_exposure: number;
  diff_time_above_density_threshold_sec: number;
  winner: 'adaptive' | 'baseline' | 'tie';
  completed_both: boolean;
  baseline_wall_time_ms: number;
  adaptive_wall_time_ms: number;
  peak_memory_mb: number;
  peak_python_heap_mb: number;
  peak_process_rss_mb: number;
  diff_wheelchair_mean_evacuation_time_sec?: number | null;
}

export interface SummaryStatistics {
  sample_size: number;
  completed_sample_size: number;
  incomplete_evacuation_count: number;
  baseline_mean_time_sec?: number | null;
  baseline_median_time_sec?: number | null;
  baseline_std_time_sec?: number | null;
  adaptive_mean_time_sec?: number | null;
  adaptive_median_time_sec?: number | null;
  adaptive_std_time_sec?: number | null;
  mean_time_difference_sec?: number | null;
  median_time_difference_sec?: number | null;
  mean_relative_improvement_pct?: number | null;
  ci_95_lower?: number | null;
  ci_95_upper?: number | null;
  p_value?: number | null;
  statistical_method: string;
  is_statistically_significant: boolean;
  adaptive_wins: number;
  baseline_wins: number;
  ties: number;
  mean_peak_queue_reduction: number;
  mean_peak_density_reduction: number;
  mean_waiting_time_reduction_sec: number;
  mean_hazard_exposure_reduction: number;
  mean_adaptive_reroutes: number;
  baseline_mean_wheelchair_evacuation_time_sec?: number | null;
  adaptive_mean_wheelchair_evacuation_time_sec?: number | null;
  mean_wheelchair_time_difference_sec?: number | null;
  avg_trial_runtime_ms: number;
  total_benchmark_wall_sec: number;
  peak_memory_mb: number;
  peak_python_heap_mb: number;
  peak_process_rss_mb: number;
  memory_measurement_note: string;
  evidence_tier: 'preliminary' | 'multi-seed' | 'replicated';
  uncertainty_note: string;
}

export interface ExperimentResult {
  job_id: string;
  scenario_id: string;
  scenario_name: string;
  occupant_count: number;
  seeds: number[];
  timestamp: string;
  trials: PairedTrialMetrics[];
  summary: SummaryStatistics;
  methodology_notes: string;
}

export interface ExperimentJobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  completed_trials: number;
  total_trials: number;
  scenario_id: string;
  occupant_count: number;
  error?: string | null;
  result?: ExperimentResult | null;
}


export interface RoomGuidance {
  roomId: string;
  roomName: string;
  floorId: string;
  floorName: string;
  primaryExitId: string;
  primaryExitName: string;
  alternativeExitId: string;
  alternativeExitName: string;
  routeDistanceMeters: number;
  estimatedEgressTimeSec: number;
  routeNodeIds: string[];
  alternativeRouteDistanceMeters?: number | null;
  status: 'clear' | 'congested' | 'hazard_exposed' | 'unreachable';
  isWheelchairAccessible: boolean;
  accessibleExitId: string;
  accessibleExitName: string;
  accessibleRouteDistanceMeters?: number | null;
  accessibilityStatus: 'route_available' | 'room_not_accessible' | 'unreachable';
  maxCapacity: number;
}

export interface FloorGuidance {
  floorId: string;
  floorName: string;
  level: number;
  occupantCount: number;
  evacuatedCount: number;
  activeEvacuees: number;
  evacuationProgressPercent: number;
  activeExits: string[];
  recommendedStairs: string[];
  recommendedRamps: string[];
  hazardRisk: 'low' | 'moderate' | 'high' | 'critical';
  rooms: RoomGuidance[];
}

export interface OccupantGuidance {
  occupantId: string;
  mobilityCategory: string;
  currentFloorId: string;
  targetExitId: string;
  targetExitName: string;
  distanceRemainingMeters: number;
  estimatedArrivalSec: number;
  turnByTurnInstructions: string[];
  rerouteExplanation?: string | null;
}

export interface BuildingEvacuationGuidance {
  buildingId: string;
  buildingName: string;
  timestamp: string;
  totalOccupants: number;
  evacuatedOccupants: number;
  overallProgressPercent: number;
  estimatedClearanceTimeSec: number;
  bottleneckRiskIndex: number;
  egressReadinessRating: 'optimal' | 'good' | 'constrained' | 'hazardous';
  floors: FloorGuidance[];
  rooms: RoomGuidance[];
  occupantsGuidance: OccupantGuidance[];
  emergencyActionChecklist: string[];
}
