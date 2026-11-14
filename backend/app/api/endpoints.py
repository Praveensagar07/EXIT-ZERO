from app.simulation.guidance import generate_building_guidance, format_guidance_markdown
from app.simulation.importer import import_gltf_or_cad_mesh, import_scenario_json
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
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

from app.models.building import (
    BoundingBox,
    Building,
    Doorway,
    Exit,
    Floor,
    HazardSource,
    Room,
    RoomType,
    SpawnZone,
    Stairwell,
)
from app.models.scenario import ScenarioConfig, ScenarioSummary
from app.models.simulation_state import (
    SimulationInitRequest,
    SimulationState,
    SimulationStepRequest,
)
from app.simulation.engine import SimulationEngine
from app.simulation.graph_generator import BuildingGraphGenerator
from app.simulation.scenarios import SCENARIO_REGISTRY, get_scenario, list_scenarios

router = APIRouter(prefix="/api")

# Directory for user-created custom buildings
_CUSTOM_BUILDINGS_DIR = Path(__file__).resolve().parents[3] / "scenarios" / "custom_buildings"
_CUSTOM_BUILDINGS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory store for active simulation sessions
active_sessions: Dict[str, SimulationEngine] = {}


class BuildingSummary(BaseModel):
    id: str
    name: str
    description: str
    floor_count: int
    room_count: int
    corridor_count: int
    exit_count: int
    stair_count: int
    ramp_count: int
    total_capacity: int
    is_custom: bool = False


class BuildingValidationReport(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    stats: Dict[str, int] = {}
    audit: Optional[Dict[str, object]] = None


class BuildingRunRequest(BaseModel):
    occupant_count: Optional[int] = None
    algorithm: str = "adaptive"
    seed: int = 42


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str
    capabilities: List[str]


class GraphValidationRequest(BaseModel):
    scenario_id: Optional[str] = None
    custom_scenario: Optional[ScenarioConfig] = None


def _summarize_building(building: Building, is_custom: bool = False) -> BuildingSummary:
    floors = building.floors
    room_count = sum(len(f.rooms) for f in floors)
    exit_count = sum(len(f.exits) for f in floors)
    stair_count = sum(sum(1 for s in f.stairwells if not s.is_ramp) for f in floors)
    ramp_count = sum(sum(1 for s in f.stairwells if s.is_ramp) for f in floors)
    capacity = sum(sum(r.max_capacity for r in f.rooms) for f in floors)
    corridor_count = len(floors) * 4

    return BuildingSummary(
        id=building.id,
        name=building.name,
        description=building.description,
        floor_count=len(floors),
        room_count=room_count,
        corridor_count=corridor_count,
        exit_count=exit_count,
        stair_count=stair_count,
        ramp_count=ramp_count,
        total_capacity=capacity if capacity > 0 else 100,
        is_custom=is_custom,
    )


def _load_building_by_id(building_id: str) -> Optional[Building]:
    # 1. Custom file
    custom_path = _CUSTOM_BUILDINGS_DIR / f"{building_id}.json"
    if custom_path.exists():
        try:
            data = json.loads(custom_path.read_text(encoding="utf-8"))
            return Building.model_validate(data)
        except Exception:
            pass

    # 2. Check scenarios
    for sc in SCENARIO_REGISTRY.values():
        if sc.building.id == building_id or sc.id == building_id:
            return sc.building

    return None


@router.get("/buildings", response_model=List[BuildingSummary])
def list_buildings():
    buildings: List[BuildingSummary] = []
    seen_ids = set()

    # 1. Built-in scenario buildings
    for sc in SCENARIO_REGISTRY.values():
        b = sc.building
        if b.id not in seen_ids:
            seen_ids.add(b.id)
            buildings.append(_summarize_building(b, is_custom=False))

    # 2. Custom saved buildings
    if _CUSTOM_BUILDINGS_DIR.exists():
        for file in _CUSTOM_BUILDINGS_DIR.glob("*.json"):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                b = Building.model_validate(data)
                if b.id not in seen_ids:
                    seen_ids.add(b.id)
                    buildings.append(_summarize_building(b, is_custom=True))
            except Exception:
                continue

    return buildings


@router.get("/buildings/{building_id}", response_model=Building)
def get_building_detail(building_id: str):
    b = _load_building_by_id(building_id)
    if not b:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found.")
    return b


@router.post("/buildings", response_model=BuildingSummary)
def create_custom_building(building: Building):
    file_path = _CUSTOM_BUILDINGS_DIR / f"{building.id}.json"
    file_path.write_text(building.model_dump_json(indent=2), encoding="utf-8")
    return _summarize_building(building, is_custom=True)


@router.put("/buildings/{building_id}", response_model=BuildingSummary)
def update_custom_building(building_id: str, building: Building):
    building.id = building_id
    file_path = _CUSTOM_BUILDINGS_DIR / f"{building_id}.json"
    file_path.write_text(building.model_dump_json(indent=2), encoding="utf-8")
    return _summarize_building(building, is_custom=True)


@router.delete("/buildings/{building_id}")
def delete_custom_building(building_id: str):
    file_path = _CUSTOM_BUILDINGS_DIR / f"{building_id}.json"
    if file_path.exists():
        file_path.unlink()
        return {"status": "deleted", "building_id": building_id}
    raise HTTPException(status_code=404, detail=f"Custom building '{building_id}' not found.")


@router.post("/buildings/validate", response_model=BuildingValidationReport)
def validate_building_endpoint(building: Building):
    errors: List[str] = []
    warnings: List[str] = []

    if not building.floors:
        errors.append("Building must contain at least one floor.")

    total_exits = sum(len(f.exits) for f in building.floors)
    if total_exits == 0:
        errors.append("Building has zero emergency exits defined.")

    floor_ids = {f.id for f in building.floors}
    for f in building.floors:
        for s in f.stairwells:
            if s.from_floor not in floor_ids:
                errors.append(f"Connector '{s.id}' references nonexistent from_floor '{s.from_floor}'.")
            if s.to_floor not in floor_ids:
                errors.append(f"Connector '{s.id}' references nonexistent to_floor '{s.to_floor}'.")

    audit = None
    if not errors:
        try:
            gen = BuildingGraphGenerator(waypoint_spacing=4.0)
            if len(building.floors) > 1:
                G, nav_model = gen.generate_building_graph(building)
            else:
                G, nav_model = gen.generate_floor_graph(building.floors[0])
            audit = gen.validate_graph(G, nav_model)
            if not audit["is_valid"]:
                if audit.get("unreachable_rooms"):
                    errors.append(f"Unreachable rooms detected: {audit['unreachable_rooms']}")
            if audit.get("wheelchair_accessible_coverage_percent", 100.0) < 50.0:
                warnings.append(f"Low wheelchair accessible coverage ({audit['wheelchair_accessible_coverage_percent']}%)")
        except Exception as e:
            errors.append(f"Graph generation failure: {str(e)}")

    summary = _summarize_building(building)
    return BuildingValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        stats={
            "floors": summary.floor_count,
            "rooms": summary.room_count,
            "corridors": summary.corridor_count,
            "exits": summary.exit_count,
            "stairs": summary.stair_count,
            "ramps": summary.ramp_count,
            "capacity": summary.total_capacity,
        },
        audit=audit,
    )


@router.post("/buildings/{building_id}/run", response_model=SimulationState)
def run_custom_building_simulation(building_id: str, req: BuildingRunRequest):
    building = _load_building_by_id(building_id)
    if not building:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found.")

    # Create dynamic spawn zones from rooms if none exist
    spawn_zones = []
    for f in building.floors:
        for r in f.rooms:
            spawn_zones.append(
                SpawnZone(
                    id=f"sp_{r.id}",
                    floor_id=f.id,
                    name=f"Zone {r.name}",
                    bounds=r.bounds,
                    occupant_count=max(2, int(r.max_capacity * 0.5)),
                    wheelchair_ratio=0.10,
                    reduced_mobility_ratio=0.15,
                )
            )

    scenario_id = f"custom_scenario_{building.id}"
    total_occ = req.occupant_count or min(150, sum(z.occupant_count for z in spawn_zones) or 50)

    scenario = ScenarioConfig(
        id=scenario_id,
        name=f"Simulation: {building.name}",
        description=f"Automated simulation generated from Building Studio for {building.name}.",
        building=building,
        hazard_sources=[],
        spawn_zones=spawn_zones,
        events=[],
        total_occupants=total_occ,
        default_seed=req.seed,
    )

    SCENARIO_REGISTRY[scenario_id] = scenario

    engine = SimulationEngine(
        scenario_config=scenario,
        algorithm=req.algorithm,
        seed=req.seed,
        occupant_count_override=total_occ,
    )
    active_sessions[engine.session_id] = engine
    return engine.get_state()


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


class GuidanceRequest(BaseModel):
    scenario_id: Optional[str] = "scenario_multifloor_demo"
    session_id: Optional[str] = None
    algorithm: Optional[str] = "adaptive"


class ImportGLTFRequest(BaseModel):
    name: Optional[str] = "Imported 3D CAD/GLTF Model"
    bounds: Optional[Dict[str, float]] = None
    floors_count: Optional[int] = 3
    raw_payload: Optional[Dict[str, Any]] = None


@router.post("/buildings/import-gltf", response_model=BuildingSummary)
def import_gltf_building(req: ImportGLTFRequest):
    data = {"name": req.name, "bounds": req.bounds}
    if req.raw_payload:
        data.update(req.raw_payload)
    b = import_gltf_or_cad_mesh(data)
    file_path = _CUSTOM_BUILDINGS_DIR / f"{b.id}.json"
    file_path.write_text(b.model_dump_json(indent=2), encoding="utf-8")
    return _summarize_building(b, is_custom=True)


@router.post("/guidance/generate")
def get_guidance(req: GuidanceRequest):
    engine = None
    if req.session_id and req.session_id in active_sessions:
        engine = active_sessions[req.session_id]
    else:
        scen_id = req.scenario_id or "scenario_multifloor_demo"
        if scen_id not in SCENARIO_REGISTRY:
            scen_id = "scenario_multifloor_demo"
        scen = SCENARIO_REGISTRY[scen_id]
        from app.models.scenario import AlgorithmType
        algo = AlgorithmType.ADAPTIVE if (req.algorithm or "").lower() == "adaptive" else AlgorithmType.BASELINE
        engine = SimulationEngine(scenario_config=scen, algorithm=algo, seed=42)
        active_sessions[engine.session_id] = engine

    return generate_building_guidance(engine)


@router.get("/guidance/report/{session_id}")
def get_guidance_report(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail=f"Simulation session '{session_id}' not found.")
    guidance = generate_building_guidance(active_sessions[session_id])
    md = format_guidance_markdown(guidance)
    return PlainTextResponse(content=md, media_type="text/markdown")
