import json
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.experiments.exporter import export_to_csv, export_to_json
from app.experiments.job_manager import job_manager
from app.experiments.models import (
    ExperimentJobStatus,
    ExperimentResult,
    ExperimentRunRequest,
)

from app.models.scenario import ScenarioConfig, ScenarioSummary
from app.models.simulation_state import (
    SimulationInitRequest,
    SimulationState,
    SimulationStepRequest,
)
from app.simulation.engine import SimulationEngine
from app.simulation.graph_generator import BuildingGraphGenerator
from app.simulation.scenarios import get_scenario, list_scenarios

router = APIRouter(prefix="/api")

# In-memory store for active simulation sessions
active_sessions: Dict[str, SimulationEngine] = {}


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str
    capabilities: List[str]


class GraphValidationRequest(BaseModel):
    scenario_id: Optional[str] = None
    custom_scenario: Optional[ScenarioConfig] = None


@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        service="EXIT-ZERO Emergency Evacuation Digital Twin Engine",
        capabilities=[
            "spatial_graph_generation",
            "microscopic_occupant_tracking",
            "baseline_dijkstra_routing",
            "adaptive_congestion_routing",
            "wheelchair_accessibility_auditing",
            "deterministic_reproducibility",
        ],
    )


@router.get("/scenarios", response_model=List[ScenarioSummary])
def get_scenarios_list():
    return list_scenarios()


@router.get("/scenarios/{scenario_id}", response_model=ScenarioConfig)
def get_scenario_detail(scenario_id: str):
    try:
        return get_scenario(scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")


@router.post("/scenarios/validate")
def validate_scenario_topology(request: GraphValidationRequest):
    if request.scenario_id:
        try:
            scenario = get_scenario(request.scenario_id)
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Scenario '{request.scenario_id}' not found.")
    elif request.custom_scenario:
        scenario = request.custom_scenario
    else:
        raise HTTPException(
            status_code=400, detail="Must provide either scenario_id or custom_scenario."
        )

    floor = scenario.building.floors[0]
    generator = BuildingGraphGenerator(waypoint_spacing=4.0)
    G, nav_model = generator.generate_floor_graph(floor)
    audit = generator.validate_graph(G, nav_model)

    return {
        "scenario_id": scenario.id,
        "scenario_name": scenario.name,
        "floor_id": floor.id,
        "audit": audit,
        "graph_nodes_count": len(nav_model.nodes),
        "graph_edges_count": len(nav_model.edges),
    }


@router.post("/simulation/init", response_model=SimulationState)
def initialize_simulation(req: SimulationInitRequest):
    try:
        scenario = get_scenario(req.scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{req.scenario_id}' not found.")

    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=req.algorithm,
        seed=req.seed,
        occupant_count_override=req.occupant_count_override,
        algorithm_weights=req.algorithm_weights,
    )

    active_sessions[engine.session_id] = engine
    return engine.get_state()


@router.get("/simulation/{session_id}/state", response_model=SimulationState)
def get_simulation_state(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Simulation session '{session_id}' not found.")
    return active_sessions[session_id].get_state()


@router.post("/simulation/{session_id}/step", response_model=SimulationState)
def step_simulation(session_id: str, req: SimulationStepRequest):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Simulation session '{session_id}' not found.")

    engine = active_sessions[session_id]
    if req.toggle_blocked_exit:
        engine.toggle_exit_block(req.toggle_blocked_exit)

    for _ in range(req.steps):
        engine.step(dt=req.dt)

    return engine.get_state()


@router.post("/simulation/{session_id}/toggle-exit/{exit_id}", response_model=SimulationState)
def toggle_exit_blockage(session_id: str, exit_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Simulation session '{session_id}' not found.")

    engine = active_sessions[session_id]
    success = engine.toggle_exit_block(exit_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Exit '{exit_id}' not found in simulation.")

    return engine.get_state()


@router.post("/simulation/{session_id}/reset", response_model=SimulationState)
def reset_simulation(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Simulation session '{session_id}' not found.")

    old_engine = active_sessions[session_id]
    new_engine = SimulationEngine(
        scenario_config=old_engine.scenario,
        algorithm=old_engine.algorithm,
        seed=old_engine.seed,
        occupant_count_override=old_engine.target_occupant_count,
        algorithm_weights=old_engine.weights,
    )
    # Keep the same session_id for continuity
    new_engine.session_id = session_id
    active_sessions[session_id] = new_engine
    return new_engine.get_state()


# ---------------------------------------------------------------------------
# Phase 4: Batch Experiment & Validation Endpoints
# ---------------------------------------------------------------------------

@router.post("/experiments/run", response_model=Dict[str, str])
def trigger_batch_experiment(request: ExperimentRunRequest):
    """
    Initiates a background asynchronous batch experiment comparing Baseline
    and EXIT-ZERO across configured seeds and population sizes.
    """
    try:
        get_scenario(request.scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{request.scenario_id}' not found.")

    if not request.seeds or len(request.seeds) == 0:
        raise HTTPException(status_code=400, detail="Must provide at least one random seed.")

    job_id = job_manager.create_job(request)
    return {"job_id": job_id, "status": "pending"}


@router.get("/experiments/{job_id}/status", response_model=ExperimentJobStatus)
def get_experiment_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Experiment job '{job_id}' not found.")
    return job


@router.get("/experiments/{job_id}/results", response_model=ExperimentResult)
def get_experiment_results(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Experiment job '{job_id}' not found.")
    if job.status != "completed" or not job.result:
        raise HTTPException(
            status_code=400,
            detail=f"Experiment job '{job_id}' is {job.status}. Results not yet available.",
        )
    return job.result


_EXPERIMENTS_DIR = Path(__file__).resolve().parents[3] / "experiments"


def _iter_saved_experiments() -> List[tuple[str, ExperimentResult]]:
    if not _EXPERIMENTS_DIR.exists():
        return []
    loaded: List[tuple[str, ExperimentResult]] = []
    for path in sorted(_EXPERIMENTS_DIR.glob("benchmark_*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            loaded.append((path.name, ExperimentResult.model_validate(data)))
        except Exception:
            continue
    return loaded


def _load_saved_experiment_by_scenario(scenario_id: str) -> Optional[ExperimentResult]:
    matches = [
        (name, res)
        for name, res in _iter_saved_experiments()
        if res.scenario_id == scenario_id
    ]
    if not matches:
        return None
    matches.sort(
        key=lambda item: (item[1].summary.sample_size, 1 if "_v2" in item[0] else 0, item[0]),
        reverse=True,
    )
    return matches[0][1]


def _resolve_experiment_result(job_id: str) -> Optional[ExperimentResult]:
    job = job_manager.get_job(job_id)
    if job and job.result:
        return job.result
    for _, res in _iter_saved_experiments():
        if res.job_id == job_id:
            return res
    return None


@router.get("/experiments/saved/{scenario_id}", response_model=ExperimentResult)
def get_saved_experiment(scenario_id: str):
    result = _load_saved_experiment_by_scenario(scenario_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No saved benchmark artifact found for scenario '{scenario_id}'.",
        )
    return result


@router.get("/experiments/{job_id}/export/csv")
def download_experiment_csv(job_id: str):
    result = _resolve_experiment_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Completed experiment '{job_id}' not found.")

    csv_data = export_to_csv(result)
    filename = f"exit_zero_{result.scenario_id}_N{result.occupant_count}_{job_id}.csv"
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/experiments/{job_id}/export/json")
def download_experiment_json(job_id: str):
    result = _resolve_experiment_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Completed experiment '{job_id}' not found.")

    json_data = export_to_json(result)
    filename = f"exit_zero_{result.scenario_id}_N{result.occupant_count}_{job_id}.json"
    return PlainTextResponse(
        content=json_data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/experiments/history", response_model=List[ExperimentJobStatus])
def list_experiment_history():
    return job_manager.list_jobs()
