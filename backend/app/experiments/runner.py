import os
import time
import tracemalloc
import uuid
from typing import Callable, Optional

from app.experiments.models import (
    ExperimentResult,
    ExperimentRunRequest,
    PairedTrialMetrics,
)
from app.experiments.statistics import aggregate_experiment_statistics, safe_relative_pct
from app.models.scenario import AlgorithmType
from app.models.simulation_state import SimulationStatus
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import get_scenario
import psutil


_PROCESS = psutil.Process(os.getpid())


def _rss_mb() -> float:
    """Return current resident set size for the whole Python process."""
    return _PROCESS.memory_info().rss / (1024.0 * 1024.0)


def run_paired_trial(
    scenario_id: str,
    seed: int,
    occupant_count: int = 150,
    max_sim_time_sec: float = 300.0,
    dt: float = 0.5,
) -> PairedTrialMetrics:
    """
    Executes an identical paired trial for BASELINE vs EXIT-ZERO under the exact same seed,
    occupant spawning coordinates, walking speeds, and shared physical crowd dynamics.
    """
    scenario_cfg = get_scenario(scenario_id)

    # 1. Run BASELINE Strategy
    t0_base = time.perf_counter()
    engine_base = SimulationEngine(
        scenario_config=scenario_cfg,
        algorithm=AlgorithmType.BASELINE,
        seed=seed,
        occupant_count_override=occupant_count,
        max_time_sec=max_sim_time_sec,
    )

    max_steps = int(max_sim_time_sec / dt) + 10
    peak_rss_mb = _rss_mb()
    while engine_base.status != SimulationStatus.COMPLETED and engine_base.step_count < max_steps:
        engine_base.step(dt=dt)
        peak_rss_mb = max(peak_rss_mb, _rss_mb())

    base_wall_ms = (time.perf_counter() - t0_base) * 1000.0
    base_metrics = engine_base.metrics

    # 2. Run EXIT-ZERO ADAPTIVE Strategy
    t0_adapt = time.perf_counter()
    engine_adapt = SimulationEngine(
        scenario_config=scenario_cfg,
        algorithm=AlgorithmType.ADAPTIVE,
        seed=seed,
        occupant_count_override=occupant_count,
        max_time_sec=max_sim_time_sec,
    )

    while engine_adapt.status != SimulationStatus.COMPLETED and engine_adapt.step_count < max_steps:
        engine_adapt.step(dt=dt)
        peak_rss_mb = max(peak_rss_mb, _rss_mb())

    adapt_wall_ms = (time.perf_counter() - t0_adapt) * 1000.0
    adapt_metrics = engine_adapt.metrics

    # 3. Analyze Comparative Outcomes
    base_completed = base_metrics.is_evacuation_complete
    adapt_completed = adapt_metrics.is_evacuation_complete

    diff_time = None
    rel_pct = None
    if base_completed and adapt_completed:
        if base_metrics.total_evacuation_time_sec is not None and adapt_metrics.total_evacuation_time_sec is not None:
            diff_time = round(base_metrics.total_evacuation_time_sec - adapt_metrics.total_evacuation_time_sec, 2)
            rel_pct = safe_relative_pct(base_metrics.total_evacuation_time_sec, adapt_metrics.total_evacuation_time_sec)

    # Median and P95 differences
    diff_med = None
    if base_metrics.median_evacuation_time_sec is not None and adapt_metrics.median_evacuation_time_sec is not None:
        diff_med = round(base_metrics.median_evacuation_time_sec - adapt_metrics.median_evacuation_time_sec, 2)

    diff_p95 = None
    if base_metrics.p95_evacuation_time_sec is not None and adapt_metrics.p95_evacuation_time_sec is not None:
        diff_p95 = round(base_metrics.p95_evacuation_time_sec - adapt_metrics.p95_evacuation_time_sec, 2)

    diff_density = round(base_metrics.max_crowd_density - adapt_metrics.max_crowd_density, 2)
    diff_queue = base_metrics.max_exit_queue_length - adapt_metrics.max_exit_queue_length
    diff_wait = round((base_metrics.mean_waiting_time_sec or 0.0) - (adapt_metrics.mean_waiting_time_sec or 0.0), 2)
    diff_hazard = round((base_metrics.cumulative_hazard_exposure or 0.0) - (adapt_metrics.cumulative_hazard_exposure or 0.0), 2)
    diff_threshold_time = round((base_metrics.time_above_density_threshold_sec or 0.0) - (adapt_metrics.time_above_density_threshold_sec or 0.0), 2)
    diff_wheelchair_time = None
    if (
        base_metrics.mean_wheelchair_evacuation_time_sec is not None
        and adapt_metrics.mean_wheelchair_evacuation_time_sec is not None
    ):
        diff_wheelchair_time = round(
            base_metrics.mean_wheelchair_evacuation_time_sec
            - adapt_metrics.mean_wheelchair_evacuation_time_sec,
            2,
        )

    # Determine trial winner without bias
    winner = "tie"
    if base_completed and adapt_completed:
        if diff_time is not None:
            if diff_time > 0.5:
                winner = "adaptive"
            elif diff_time < -0.5:
                winner = "baseline"
            else:
                winner = "tie"
    elif adapt_completed and not base_completed:
        winner = "adaptive"
    elif base_completed and not adapt_completed:
        winner = "baseline"
    else:
        # Neither fully completed: compare trapped occupants
        if adapt_metrics.trapped_occupants < base_metrics.trapped_occupants:
            winner = "adaptive"
        elif base_metrics.trapped_occupants < adapt_metrics.trapped_occupants:
            winner = "baseline"
        elif adapt_metrics.completion_percentage > base_metrics.completion_percentage:
            winner = "adaptive"
        elif base_metrics.completion_percentage > adapt_metrics.completion_percentage:
            winner = "baseline"
        else:
            winner = "tie"

    return PairedTrialMetrics(
        seed=seed,
        scenario_id=scenario_id,
        occupant_count=occupant_count,
        baseline_metrics=base_metrics,
        adaptive_metrics=adapt_metrics,
        diff_evacuation_time_sec=diff_time,
        relative_time_improvement_pct=rel_pct,
        diff_median_time_sec=diff_med,
        diff_p95_time_sec=diff_p95,
        diff_peak_density=diff_density,
        diff_peak_queue=diff_queue,
        diff_waiting_time_sec=diff_wait,
        diff_hazard_exposure=diff_hazard,
        diff_time_above_density_threshold_sec=diff_threshold_time,
        diff_wheelchair_mean_evacuation_time_sec=diff_wheelchair_time,
        winner=winner,
        completed_both=(base_completed and adapt_completed),
        baseline_wall_time_ms=round(base_wall_ms, 2),
        adaptive_wall_time_ms=round(adapt_wall_ms, 2),
        peak_memory_mb=0.0,
        peak_python_heap_mb=0.0,
        peak_process_rss_mb=round(peak_rss_mb, 2),
    )


def run_experiment(
    request: ExperimentRunRequest,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> ExperimentResult:
    """
    Executes a multi-seed batch experiment across requested seeds and populates
    statistical summaries, bootstrap confidence intervals, and performance telemetry.
    """
    job_id = f"exp_{uuid.uuid4().hex[:8]}"
    scenario_cfg = get_scenario(request.scenario_id)

    tracemalloc.start()
    t_start = time.perf_counter()

    trials = []
    total_seeds = len(request.seeds)

    for idx, seed in enumerate(request.seeds):
        trial = run_paired_trial(
            scenario_id=request.scenario_id,
            seed=seed,
            occupant_count=request.occupant_count,
            max_sim_time_sec=request.max_sim_time_sec,
            dt=request.dt,
        )
        trials.append(trial)

        if progress_callback:
            progress_callback(idx + 1, total_seeds)

    total_wall_sec = time.perf_counter() - t_start
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    peak_mem_mb = round(peak_mem / (1024.0 * 1024.0), 2)
    peak_rss_mb = max((t.peak_process_rss_mb for t in trials), default=_rss_mb())
    for t in trials:
        t.peak_memory_mb = peak_mem_mb
        t.peak_python_heap_mb = peak_mem_mb

    summary = aggregate_experiment_statistics(
        trials=trials,
        total_wall_sec=total_wall_sec,
        peak_memory_mb=peak_mem_mb,
        peak_process_rss_mb=peak_rss_mb,
    )

    return ExperimentResult(
        job_id=job_id,
        scenario_id=request.scenario_id,
        scenario_name=scenario_cfg.name,
        occupant_count=request.occupant_count,
        seeds=request.seeds,
        trials=trials,
        summary=summary,
    )
