from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.models.simulation_state import SimulationMetrics


class ExperimentRunRequest(BaseModel):
    scenario_id: str = "scenario_sudden_exit_closure"
    occupant_count: int = 150
    seeds: List[int] = Field(default_factory=lambda: list(range(101, 121))) # Default 20 seeds
    max_sim_time_sec: float = 300.0
    dt: float = 0.5


class PairedTrialMetrics(BaseModel):
    seed: int
    scenario_id: str
    occupant_count: int
    baseline_metrics: SimulationMetrics
    adaptive_metrics: SimulationMetrics

    # Paired differences (Baseline - Adaptive; positive means Adaptive outperformed Baseline)
    diff_evacuation_time_sec: Optional[float] = None
    relative_time_improvement_pct: Optional[float] = None
    diff_median_time_sec: Optional[float] = None
    diff_p95_time_sec: Optional[float] = None
    diff_peak_density: float = 0.0
    diff_peak_queue: int = 0
    diff_waiting_time_sec: float = 0.0
    diff_hazard_exposure: float = 0.0
    diff_time_above_density_threshold_sec: float = 0.0
    diff_wheelchair_mean_evacuation_time_sec: Optional[float] = None

    winner: str = "tie"  # "adaptive", "baseline", "tie"
    completed_both: bool = True
    baseline_wall_time_ms: float = 0.0
    adaptive_wall_time_ms: float = 0.0
    peak_memory_mb: float = 0.0
    peak_python_heap_mb: float = 0.0
    peak_process_rss_mb: float = 0.0


class SummaryStatistics(BaseModel):
    sample_size: int = 0
    completed_sample_size: int = 0
    incomplete_evacuation_count: int = 0

    # Evacuation Time Stats
    baseline_mean_time_sec: Optional[float] = None
    baseline_median_time_sec: Optional[float] = None
    baseline_std_time_sec: Optional[float] = None

    adaptive_mean_time_sec: Optional[float] = None
    adaptive_median_time_sec: Optional[float] = None
    adaptive_std_time_sec: Optional[float] = None

    mean_time_difference_sec: Optional[float] = None
    median_time_difference_sec: Optional[float] = None
    mean_relative_improvement_pct: Optional[float] = None

    # Confidence Interval & Statistical Significance
    ci_95_lower: Optional[float] = None
    ci_95_upper: Optional[float] = None
    p_value: Optional[float] = None
    statistical_method: str = (
        "Percentile bootstrap (N=2000, seed=2026) & two-sided sign-flip test "
        "(exact for n<=20; deterministic Monte Carlo above 20)"
    )
    is_statistically_significant: bool = False

    # Win / Loss Counts
    adaptive_wins: int = 0
    baseline_wins: int = 0
    ties: int = 0

    # Bottleneck & Congestion Reductions
    mean_peak_queue_reduction: float = 0.0
    mean_peak_density_reduction: float = 0.0
    mean_waiting_time_reduction_sec: float = 0.0
    mean_hazard_exposure_reduction: float = 0.0
    mean_adaptive_reroutes: float = 0.0

    # Accessibility outcomes (seed-level wheelchair means aggregated across paired trials)
    baseline_mean_wheelchair_evacuation_time_sec: Optional[float] = None
    adaptive_mean_wheelchair_evacuation_time_sec: Optional[float] = None
    mean_wheelchair_time_difference_sec: Optional[float] = None

    # Computational Performance
    avg_trial_runtime_ms: float = 0.0
    total_benchmark_wall_sec: float = 0.0
    peak_memory_mb: float = 0.0
    peak_python_heap_mb: float = 0.0
    peak_process_rss_mb: float = 0.0
    memory_measurement_note: str = (
        "Python heap is measured by tracemalloc; process RSS is sampled with psutil at simulation-step boundaries."
    )

    # Evidence-strength disclosure
    evidence_tier: str = "preliminary"
    uncertainty_note: str = "Fewer than 10 paired seeds; treat estimates and intervals as preliminary."


class ExperimentResult(BaseModel):
    job_id: str
    scenario_id: str
    scenario_name: str
    occupant_count: int
    seeds: List[int]
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    trials: List[PairedTrialMetrics] = Field(default_factory=list)
    summary: SummaryStatistics = Field(default_factory=SummaryStatistics)
    methodology_notes: str = (
        "Rigorous paired-seed evaluation across identical initial geometry, walking speeds, "
        "and physical crowd substrate. All density thresholds are physical simulation indicators "
        "and do not constitute validated physiological crush injury thresholds."
    )


class ExperimentJobStatus(BaseModel):
    job_id: str
    status: str = "pending"  # "pending", "running", "completed", "failed"
    progress_pct: float = 0.0
    completed_trials: int = 0
    total_trials: int = 0
    scenario_id: str = ""
    occupant_count: int = 0
    error: Optional[str] = None
    result: Optional[ExperimentResult] = None
