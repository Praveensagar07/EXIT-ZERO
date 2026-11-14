import json
import pytest
from app.experiments.exporter import export_to_csv, export_to_json
from app.experiments.job_manager import ExperimentJobManager
from app.experiments.models import ExperimentRunRequest, PairedTrialMetrics
from app.experiments.runner import run_experiment, run_paired_trial
from app.experiments.statistics import (
    aggregate_experiment_statistics,
    compute_bootstrap_ci,
    compute_mean_median_std,
    compute_paired_permutation_test,
    safe_relative_pct,
)
from app.models.occupant import EvacuationState, MobilityCategory
from app.models.scenario import AlgorithmType
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import get_scenario


def test_identical_paired_initial_conditions():
    """
    Experimental Fairness Rule 1:
    Both BASELINE and EXIT-ZERO must receive 100% identical initial conditions:
    geometry, occupant count, positions, mobility categories, free speeds, and exit attributes.
    """
    scenario = get_scenario("scenario_sudden_exit_closure")
    seed = 42

    engine_base = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.BASELINE, seed=seed)
    engine_adapt = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.ADAPTIVE, seed=seed)

    assert len(engine_base.occupants) == len(engine_adapt.occupants)
    assert len(engine_base.exits) == len(engine_adapt.exits)
    assert len(engine_base.floor.rooms) == len(engine_adapt.floor.rooms)

    for ob, oa in zip(engine_base.occupants, engine_adapt.occupants):
        assert ob.id == oa.id
        assert ob.x == oa.x
        assert ob.y == oa.y
        assert ob.free_speed == oa.free_speed
        assert ob.mobility_category == oa.mobility_category
        assert ob.current_node_id == oa.current_node_id


def test_independent_experiment_runs():
    """
    Verifies that running trial B does not mutate or inherit internal state from trial A.
    """
    trial_1 = run_paired_trial("scenario_normal_evacuation", seed=101, occupant_count=50, max_sim_time_sec=60.0)
    trial_2 = run_paired_trial("scenario_normal_evacuation", seed=101, occupant_count=50, max_sim_time_sec=60.0)

    # Identical seed must yield identical outputs
    assert trial_1.baseline_metrics.total_evacuated == trial_2.baseline_metrics.total_evacuated
    assert trial_1.adaptive_metrics.total_evacuated == trial_2.adaptive_metrics.total_evacuated
    assert trial_1.diff_evacuation_time_sec == trial_2.diff_evacuation_time_sec


def test_metric_aggregation_and_zero_division():
    """
    Verifies mean, median, std calculation and zero-division edge cases.
    """
    # Empty list
    mean_val, med_val, std_val = compute_mean_median_std([])
    assert mean_val is None
    assert med_val is None
    assert std_val is None

    # Known sample
    vals = [10.0, 20.0, 30.0]
    mean_val, med_val, std_val = compute_mean_median_std(vals)
    assert mean_val == 20.0
    assert med_val == 20.0
    assert std_val == 10.0

    # Safe relative percentage
    assert safe_relative_pct(100.0, 80.0) == 20.0   # 20% improvement
    assert safe_relative_pct(100.0, 120.0) == -20.0 # 20% slowdown
    assert safe_relative_pct(0.0, 0.0) == 0.0       # Zero denominator
    assert safe_relative_pct(None, 50.0) is None


def test_bootstrap_ci_reproducibility_and_bounds():
    """
    Verifies that percentile bootstrap confidence intervals:
    1. Are deterministic with fixed seed.
    2. Lower bound <= Mean <= Upper bound.
    """
    diffs = [12.0, 8.5, 14.2, 9.8, 11.0, 7.5, 13.0, 10.5, 9.0, 11.5]
    ci_lower_1, ci_upper_1 = compute_bootstrap_ci(diffs, confidence=0.95, seed=2026)
    ci_lower_2, ci_upper_2 = compute_bootstrap_ci(diffs, confidence=0.95, seed=2026)

    assert ci_lower_1 == ci_lower_2
    assert ci_upper_1 == ci_upper_2

    mean_diff = sum(diffs) / len(diffs)
    assert ci_lower_1 is not None and ci_upper_1 is not None
    assert ci_lower_1 <= mean_diff <= ci_upper_1


def test_permutation_test_significance():
    """
    Verifies permutation test p-value:
    - Large consistent differences yield p < 0.05.
    - Zero differences yield p ~ 1.0.
    """
    strong_diffs = [25.0, 22.0, 30.0, 28.0, 19.0, 26.0, 31.0, 24.0]
    p_strong = compute_paired_permutation_test(strong_diffs, n_resamples=2000, seed=2026)
    assert p_strong is not None
    assert p_strong < 0.05

    neutral_diffs = [0.0, 0.0, 0.0, 0.0]
    p_neutral = compute_paired_permutation_test(neutral_diffs, n_resamples=1000, seed=2026)
    assert p_neutral == 1.0

    # Three uniformly positive seeds can look impressive, but an exact
    # two-sided sign-flip test cannot produce p < 0.25 at n=3.
    assert compute_paired_permutation_test([86.5, 99.0, 115.0]) == 0.25


def test_incomplete_evacuation_handling():
    """
    Fairness Rule: If not everyone evacuates within max_sim_time_sec,
    do NOT report the last observed time as a completed total evacuation time.
    """
    scenario = get_scenario("scenario_congested_corridor")
    # Severely limit time so evacuation cannot finish
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.BASELINE, max_time_sec=10.0)
    for _ in range(20):
        engine.step(dt=0.5)

    metrics = engine.metrics
    assert not metrics.is_evacuation_complete
    assert metrics.completion_percentage < 100.0
    assert metrics.total_evacuation_time_sec is None  # Must NOT report total completion time!


def test_baseline_safety_recomputation_fairness():
    """
    Fairness Rule: Baseline must recompute a feasible route when an exit physically closes,
    using shortest path without congestion/hazard optimization.
    """
    scenario = get_scenario("scenario_sudden_exit_closure")
    engine = SimulationEngine(scenario_config=scenario, algorithm=AlgorithmType.BASELINE, seed=42)

    # Step past t=18.0s closure
    for _ in range(40):
        engine.step(dt=0.5)

    exit_east = next(e for e in engine.exits if e.id == "exit_east_fire")
    assert exit_east.is_blocked

    # Active occupants must have rerouted to an open exit via emergency safety recomputation
    for occ in engine.occupants:
        if occ.evacuation_state == EvacuationState.EVACUATING:
            assert occ.target_exit_id != "exit_east_fire"


def test_batch_experiment_runner_and_export():
    """
    Executes a 3-seed mini experiment and verifies CSV/JSON export structure.
    """
    req = ExperimentRunRequest(
        scenario_id="scenario_normal_evacuation",
        occupant_count=50,
        seeds=[101, 102, 103],
        max_sim_time_sec=60.0,
    )
    result = run_experiment(req)

    assert result.scenario_id == "scenario_normal_evacuation"
    assert len(result.trials) == 3
    assert result.summary.sample_size == 3
    assert result.summary.evidence_tier == "preliminary"
    assert result.summary.peak_python_heap_mb > 0
    assert result.summary.peak_process_rss_mb > 0
    assert "RSS" in result.summary.memory_measurement_note

    # Test CSV export
    csv_text = export_to_csv(result)
    assert "SUMMARY_STATISTICS" in csv_text
    assert "PER_SEED_TRIAL_DATA" in csv_text
    assert "Seed,Winner,Base_Evac_Time_s" in csv_text
    assert "Peak Python Heap (MB, tracemalloc)" in csv_text
    assert "Peak Process RSS (MB, sampled)" in csv_text

    # Test JSON export
    json_text = export_to_json(result)
    parsed = json.loads(json_text)
    assert parsed["scenario_id"] == "scenario_normal_evacuation"
    assert len(parsed["trials"]) == 3


def test_mixed_mobility_reports_wheelchair_outcomes():
    """Accessibility claims must include wheelchair timing, not only reachability."""
    trial = run_paired_trial(
        "scenario_mixed_mobility",
        seed=101,
        occupant_count=60,
        max_sim_time_sec=120.0,
    )
    for metrics in (trial.baseline_metrics, trial.adaptive_metrics):
        assert metrics.wheelchair_occupant_count > 0
        assert metrics.wheelchair_evacuated_count <= metrics.wheelchair_occupant_count
        assert 0.0 <= metrics.wheelchair_completion_percentage <= 100.0
        assert metrics.mean_wheelchair_evacuation_time_sec is not None

    assert trial.diff_wheelchair_mean_evacuation_time_sec is not None


def test_job_manager_lifecycle():
    """
    Verifies ExperimentJobManager creation, polling, and completion.
    """
    manager = ExperimentJobManager(export_dir="experiments")
    req = ExperimentRunRequest(
        scenario_id="scenario_normal_evacuation",
        occupant_count=40,
        seeds=[201, 202],
        max_sim_time_sec=40.0,
    )

    job_id = manager.create_job(req)
    assert job_id.startswith("job_")

    status = manager.get_job(job_id)
    assert status is not None
    assert status.status in ["pending", "running", "completed"]

    # Wait synchronously for quick test completion
    import time
    for _ in range(50):
        s = manager.get_job(job_id)
        if s and s.status in ["completed", "failed"]:
            break
        time.sleep(0.1)

    final_status = manager.get_job(job_id)
    assert final_status is not None
    assert final_status.status == "completed"
    assert final_status.progress_pct == 100.0
    assert final_status.result is not None
