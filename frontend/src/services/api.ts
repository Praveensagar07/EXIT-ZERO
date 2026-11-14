import type {
  ScenarioConfig,
  ScenarioSummary,
  SimulationState,
  TopologyAuditReport,
  AlgorithmType,
  ExperimentRunRequest,
  ExperimentJobStatus,
  ExperimentResult,
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

  async toggleExitBlock(sessionId: string, exitId: string): Promise<SimulationState> {
    const res = await fetch(`${API_BASE}/simulation/${sessionId}/toggle-exit/${exitId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Toggle exit failed: ${res.statusText}`);
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

  async getExperimentStatus(jobId: string): Promise<ExperimentJobStatus> {
    const res = await fetch(`${API_BASE}/experiments/${jobId}/status`);
    if (!res.ok) throw new Error(`Get experiment status failed: ${res.statusText}`);
    return res.json();
  },

  async getExperimentResults(jobId: string): Promise<ExperimentResult> {
    const res = await fetch(`${API_BASE}/experiments/${jobId}/results`);
    if (!res.ok) throw new Error(`Get experiment results failed: ${res.statusText}`);
    return res.json();
  },

  async getExperimentHistory(): Promise<ExperimentJobStatus[]> {
    const res = await fetch(`${API_BASE}/experiments/history`);
    if (!res.ok) throw new Error(`Get experiment history failed: ${res.statusText}`);
    return res.json();
  },

  async getSavedExperiment(scenarioId: string): Promise<ExperimentResult> {
    const res = await fetch(`${API_BASE}/experiments/saved/${encodeURIComponent(scenarioId)}`);
    if (!res.ok) throw new Error(`Get saved experiment failed: ${res.statusText}`);
    return res.json();
  },

  getExportCsvUrl(jobId: string): string {
    return `${API_BASE}/experiments/${jobId}/export/csv`;
  },

  getExportJsonUrl(jobId: string): string {
    return `${API_BASE}/experiments/${jobId}/export/json`;
  },
};
