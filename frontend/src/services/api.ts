import type {
  ScenarioConfig,
  ScenarioSummary,
  SimulationState,
  TopologyAuditReport,
  AlgorithmType,
  ExperimentRunRequest,
  ExperimentJobStatus,
  ExperimentResult,
  Building,
  BuildingSummary,
  BuildingValidationReport,
  BuildingEvacuationGuidance,
} from '../types/simulation';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

export interface HealthStatus {
  status: string;
  version: string;
  service: string;
  capabilities: string[];
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getScenarios(): Promise<ScenarioSummary[]> {
    const res = await fetch(`${API_BASE}/scenarios`);
    if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.statusText}`);
    return res.json();
  },

  async getScenario(id: string): Promise<ScenarioConfig> {
    const res = await fetch(`${API_BASE}/scenarios/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch scenario ${id}: ${res.statusText}`);
    return res.json();
  },

  async validateTopology(scenarioId: string): Promise<{
    scenario_id: string;
    scenario_name: string;
    floor_id: string;
    audit: TopologyAuditReport;
    graph_nodes_count: number;
    graph_edges_count: number;
  }> {
    const res = await fetch(`${API_BASE}/scenarios/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
    if (!res.ok) throw new Error(`Validation failed: ${res.statusText}`);
    return res.json();
  },

  async initSimulation(params: {
    scenarioId: string;
    algorithm?: AlgorithmType;
    seed?: number;
    occupantCountOverride?: number;
  }): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: params.scenarioId,
        algorithm: params.algorithm || 'baseline',
        seed: params.seed ?? 42,
        occupant_count_override: params.occupantCountOverride,
      }),
    });
    if (!res.ok) throw new Error(`Init simulation failed: ${res.statusText}`);
    return res.json();
  },

  async getSimulationState(sessionId: string): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/state`);
    if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
    return res.json();
  },

  async stepSimulation(
    sessionId: string,
    steps: number = 1,
    dt: number = 0.5
  ): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps, dt }),
    });
    if (!res.ok) throw new Error(`Step simulation failed: ${res.statusText}`);
    return res.json();
  },

  async resetSimulation(sessionId: string): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Reset simulation failed: ${res.statusText}`);
    return res.json();
  },

  async runSimulationToCompletion(sessionId: string, maxSteps: number = 400): Promise<SimulationState> {
    let state = await this.getSimulationState(sessionId);
    let steps = 0;
    while (state.status === 'running' && steps < maxSteps) {
      state = await this.stepSimulation(sessionId, 5, 0.5);
      steps += 5;
    }
    return state;
  },

  async toggleExit(exitId: string): Promise<{ success: boolean; exit_id: string; is_blocked: boolean }> {
    const res = await fetch(`${API_BASE}/simulation/toggle-exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exit_id: exitId }),
    });
    if (!res.ok) throw new Error(`Failed to toggle exit: ${res.statusText}`);
    return res.json();
  },

  async toggleExitBlock(sessionId: string, exitId: string): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/toggle-exit/${exitId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Toggle exit failed: ${res.statusText}`);
    return res.json();
  },

  async triggerHazard(
    sessionId: string,
    hazard: { floor_id?: string; x?: number; y?: number; hazard_type?: string; intensity?: number; growth_rate?: number; max_radius?: number }
  ): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/hazard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hazard),
    });
    if (!res.ok) throw new Error(`Trigger hazard failed: ${res.statusText}`);
    return res.json();
  },

  async triggerBatchExperiment(req: ExperimentRunRequest): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/experiments/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Trigger experiment failed: ${res.statusText}`);
    return res.json();
  },

  async startExperiment(params: ExperimentRunRequest): Promise<ExperimentJobStatus> {
    const res = await fetch(`${API_BASE}/experiments/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to start experiment: ${res.statusText}`);
    return res.json();
  },

  async getExperimentStatus(jobId: string): Promise<ExperimentJobStatus> {
    const res = await fetch(`${API_BASE}/experiments/${jobId}/status`);
    if (!res.ok) throw new Error(`Failed to fetch experiment status: ${res.statusText}`);
    return res.json();
  },

  async getExperimentResults(jobId: string): Promise<ExperimentResult> {
    const res = await fetch(`${API_BASE}/experiments/${jobId}/results`);
    if (!res.ok) throw new Error(`Failed to fetch experiment results: ${res.statusText}`);
    return res.json();
  },

  async getSavedExperiment(scenarioId: string): Promise<ExperimentResult> {
    const res = await fetch(`${API_BASE}/experiments/saved/${encodeURIComponent(scenarioId)}`);
    if (!res.ok) throw new Error(`Failed to fetch saved experiment: ${res.statusText}`);
    return res.json();
  },

  async getExperimentHistory(): Promise<ExperimentJobStatus[]> {
    const res = await fetch(`${API_BASE}/experiments/history`);
    if (!res.ok) throw new Error(`Failed to fetch experiment history: ${res.statusText}`);
    return res.json();
  },

  getExportCsvUrl(jobId: string): string {
    return `${API_BASE}/experiments/${jobId}/export/csv`;
  },

  getExportJsonUrl(jobId: string): string {
    return `${API_BASE}/experiments/${jobId}/export/json`;
  },

  async getBuildings(): Promise<BuildingSummary[]> {
    const res = await fetch(`${API_BASE}/buildings`);
    if (!res.ok) throw new Error(`Failed to fetch buildings: ${res.statusText}`);
    return res.json();
  },

  async getBuilding(id: string): Promise<Building> {
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Failed to fetch building ${id}: ${res.statusText}`);
    return res.json();
  },

  async createBuilding(building: Building): Promise<BuildingSummary> {
    const res = await fetch(`${API_BASE}/buildings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(building),
    });
    if (!res.ok) throw new Error(`Failed to create building: ${res.statusText}`);
    return res.json();
  },

  async updateBuilding(id: string, building: Building): Promise<BuildingSummary> {
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(building),
    });
    if (!res.ok) throw new Error(`Failed to update building: ${res.statusText}`);
    return res.json();
  },

  async deleteBuilding(id: string): Promise<{ status: string; building_id: string }> {
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete building: ${res.statusText}`);
    return res.json();
  },

  async validateBuilding(building: Building): Promise<BuildingValidationReport> {
    const res = await fetch(`${API_BASE}/buildings/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(building),
    });
    if (!res.ok) throw new Error(`Failed to validate building: ${res.statusText}`);
    return res.json();
  },

  async runBuildingSimulation(
    id: string,
    params: { occupant_count?: number; algorithm?: string; seed?: number }
  ): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to run building simulation: ${res.statusText}`);
    return res.json();
  },

  async importGltfBuilding(params: {
    name?: string;
    bounds?: { min_x: number; max_x: number; min_y: number; max_y: number; min_z: number; max_z: number };
    floors_count?: number;
    raw_payload?: any;
  }): Promise<BuildingSummary> {
    const res = await fetch(`${API_BASE}/buildings/import-gltf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`GLTF import failed: ${res.statusText}`);
    return res.json();
  },

  async getGuidance(params?: {
    scenario_id?: string;
    session_id?: string;
    algorithm?: string;
  }): Promise<BuildingEvacuationGuidance> {
    const res = await fetch(`${API_BASE}/guidance/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) throw new Error(`Guidance generation failed: ${res.statusText}`);
    return res.json();
  },

  getGuidanceReportUrl(sessionId: string): string {
    return `${API_BASE}/guidance/report/${encodeURIComponent(sessionId)}`;
  },
};
