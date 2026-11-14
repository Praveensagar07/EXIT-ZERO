import itertools
import math
from typing import List, Optional, Tuple
import numpy as np

from app.experiments.models import PairedTrialMetrics, SummaryStatistics


def safe_relative_pct(baseline_val: Optional[float], adaptive_val: Optional[float]) -> Optional[float]:
    """
    Computes relative percentage improvement:
    ((baseline - adaptive) / baseline) * 100
    Positive values denote that adaptive improved (reduced) the metric.
    Safeguards against zero or None baseline values.
    """
    if baseline_val is None or adaptive_val is None:
        return None
    if baseline_val <= 1e-6:
        return 0.0 if abs(baseline_val - adaptive_val) <= 1e-6 else 100.0
    return round(((baseline_val - adaptive_val) / baseline_val) * 100.0, 2)


def compute_mean_median_std(values: List[float]) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """Calculates mean, median, and sample standard deviation for a list of floats."""
    if not values:
        return None, None, None
    arr = np.array(values, dtype=float)
    mean_val = float(np.mean(arr))
    median_val = float(np.median(arr))
    std_val = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
    return round(mean_val, 2), round(median_val, 2), round(std_val, 2)


def compute_bootstrap_ci(
    differences: List[float],
    confidence: float = 0.95,
    n_resamples: int = 2000,
    seed: int = 2026,
) -> Tuple[Optional[float], Optional[float]]:
    """
    Calculates deterministic percentile bootstrap confidence intervals for paired differences.
    Uses fixed seed (2026) for strict test reproducibility without external AI dependencies.
    """
    if not differences or len(differences) == 0:
        return None, None
    if len(differences) == 1:
        return round(differences[0], 2), round(differences[0], 2)

    arr = np.array(differences, dtype=float)
    n = len(arr)
    rng = np.random.default_rng(seed)

    # Resample with replacement
    boot_indices = rng.integers(0, n, size=(n_resamples, n))
    boot_means = np.mean(arr[boot_indices], axis=1)

    alpha = 1.0 - confidence
    lower_pct = (alpha / 2.0) * 100.0
    upper_pct = (1.0 - alpha / 2.0) * 100.0

    ci_lower = float(np.percentile(boot_means, lower_pct))
    ci_upper = float(np.percentile(boot_means, upper_pct))

    return round(ci_lower, 2), round(ci_upper, 2)


def compute_paired_permutation_test(
    differences: List[float],
    n_resamples: int = 10000,
    seed: int = 2026,
) -> Optional[float]:
    """
    Computes an exact non-parametric permutation test for paired comparisons (H0: mean diff == 0).
    Under H0, each paired difference has equal probability of being positive or negative.
    """
    if not differences or len(differences) < 2:
        return None

    arr = np.array(differences, dtype=float)
    observed_mean = abs(float(np.mean(arr)))

    # If all differences are virtually zero, p-value is 1.0
    if observed_mean < 1e-6:
        return 1.0

    n = len(arr)
    if n <= 20:
        # Enumerate every sign assignment. This is exact and makes the severe
        # limitation of tiny samples visible (for n=3, two-sided p >= 0.25).
        extreme = 0
        total = 2 ** n
        for sign_tuple in itertools.product((-1.0, 1.0), repeat=n):
            perm_mean = abs(float(np.mean(arr * np.array(sign_tuple))))
            if perm_mean >= observed_mean - 1e-9:
                extreme += 1
        p_val = extreme / total
    else:
        rng = np.random.default_rng(seed)
        signs = rng.choice([-1.0, 1.0], size=(n_resamples, n))
        perm_means = np.abs(np.mean(arr * signs, axis=1))
        # Add-one correction prevents a Monte Carlo p-value of exactly zero.
        extreme = int(np.sum(perm_means >= (observed_mean - 1e-9)))
        p_val = (extreme + 1) / (n_resamples + 1)
    return round(min(1.0, p_val), 4)


def aggregate_experiment_statistics(
    trials: List[PairedTrialMetrics],
    total_wall_sec: float = 0.0,
    peak_memory_mb: float = 0.0,
    peak_process_rss_mb: float = 0.0,
) -> SummaryStatistics:
    """
    Aggregates per-seed paired trials into rigorous statistical summary,
    including paired differences, bootstrap 95% CIs, permutation test p-values,
    and win/loss/tie outcomes.
    """
    total_trials = len(trials)
    if total_trials == 0:
        return SummaryStatistics()

    completed_trials = [t for t in trials if t.completed_both and t.diff_evacuation_time_sec is not None]
    incomplete_count = total_trials - len(completed_trials)

    # Collect paired differences where both completed
    time_diffs = [t.diff_evacuation_time_sec for t in completed_trials if t.diff_evacuation_time_sec is not None]
    base_times = [
        t.baseline_metrics.total_evacuation_time_sec
        for t in completed_trials
        if t.baseline_metrics.total_evacuation_time_sec is not None
    ]
    adapt_times = [
        t.adaptive_metrics.total_evacuation_time_sec
        for t in completed_trials
        if t.adaptive_metrics.total_evacuation_time_sec is not None
    ]

    base_mean, base_med, base_std = compute_mean_median_std(base_times)
    adapt_mean, adapt_med, adapt_std = compute_mean_median_std(adapt_times)
    diff_mean, diff_med, diff_std = compute_mean_median_std(time_diffs)

    mean_rel_improvement = safe_relative_pct(base_mean, adapt_mean)

    # Bootstrap CI and Permutation p-value
    ci_lower, ci_upper = compute_bootstrap_ci(time_diffs)
    p_val = compute_paired_permutation_test(time_diffs)
    is_sig = (p_val is not None) and (p_val < 0.05) and (ci_lower is not None and ci_lower > 0)

    # Wins / losses / ties
    adapt_wins = sum(1 for t in trials if t.winner == "adaptive")
    base_wins = sum(1 for t in trials if t.winner == "baseline")
    ties = sum(1 for t in trials if t.winner == "tie")

    # Bottleneck and queue statistics across all trials
    queue_reductions = [float(t.diff_peak_queue) for t in trials]
    density_reductions = [float(t.diff_peak_density) for t in trials]
    waiting_reductions = [float(t.diff_waiting_time_sec) for t in trials]
    hazard_reductions = [float(t.diff_hazard_exposure) for t in trials]
    adaptive_reroutes = [float(t.adaptive_metrics.total_reroutes or 0) for t in trials]

    mean_queue_red, _, _ = compute_mean_median_std(queue_reductions)
    mean_density_red, _, _ = compute_mean_median_std(density_reductions)
    mean_waiting_red, _, _ = compute_mean_median_std(waiting_reductions)
    mean_hazard_red, _, _ = compute_mean_median_std(hazard_reductions)
    mean_reroutes, _, _ = compute_mean_median_std(adaptive_reroutes)

    base_wheelchair_times = [
        t.baseline_metrics.mean_wheelchair_evacuation_time_sec
        for t in completed_trials
        if t.baseline_metrics.mean_wheelchair_evacuation_time_sec is not None
    ]
    adapt_wheelchair_times = [
        t.adaptive_metrics.mean_wheelchair_evacuation_time_sec
        for t in completed_trials
        if t.adaptive_metrics.mean_wheelchair_evacuation_time_sec is not None
    ]
    wheelchair_diffs = [
        t.diff_wheelchair_mean_evacuation_time_sec
        for t in completed_trials
        if t.diff_wheelchair_mean_evacuation_time_sec is not None
    ]
    base_wc_mean, _, _ = compute_mean_median_std(base_wheelchair_times)
    adapt_wc_mean, _, _ = compute_mean_median_std(adapt_wheelchair_times)
    wc_diff_mean, _, _ = compute_mean_median_std(wheelchair_diffs)

    if len(completed_trials) >= 20:
        evidence_tier = "replicated"
        uncertainty_note = "At least 20 completed paired seeds; report effect size, interval, and p-value together."
    elif len(completed_trials) >= 10:
        evidence_tier = "multi-seed"
        uncertainty_note = "10-19 completed paired seeds; useful multi-seed evidence, but replication remains advisable."
    else:
        evidence_tier = "preliminary"
        uncertainty_note = "Fewer than 10 completed paired seeds; treat estimates and intervals as preliminary."

    # Wall runtime per trial
    trial_runtimes = [t.baseline_wall_time_ms + t.adaptive_wall_time_ms for t in trials]
    avg_trial_ms = round(sum(trial_runtimes) / max(1, total_trials), 2)

    return SummaryStatistics(
        sample_size=total_trials,
        completed_sample_size=len(completed_trials),
        incomplete_evacuation_count=incomplete_count,
        baseline_mean_time_sec=base_mean,
        baseline_median_time_sec=base_med,
        baseline_std_time_sec=base_std,
        adaptive_mean_time_sec=adapt_mean,
        adaptive_median_time_sec=adapt_med,
        adaptive_std_time_sec=adapt_std,
        mean_time_difference_sec=diff_mean,
        median_time_difference_sec=diff_med,
        mean_relative_improvement_pct=mean_rel_improvement,
        ci_95_lower=ci_lower,
        ci_95_upper=ci_upper,
        p_value=p_val,
        statistical_method="Percentile Bootstrap (N=2000, seed=2026) & Permutation Test",
        is_statistically_significant=is_sig,
        adaptive_wins=adapt_wins,
        baseline_wins=base_wins,
        ties=ties,
        mean_peak_queue_reduction=mean_queue_red or 0.0,
        mean_peak_density_reduction=mean_density_red or 0.0,
        mean_waiting_time_reduction_sec=mean_waiting_red or 0.0,
        mean_hazard_exposure_reduction=mean_hazard_red or 0.0,
        mean_adaptive_reroutes=mean_reroutes or 0.0,
        baseline_mean_wheelchair_evacuation_time_sec=base_wc_mean,
        adaptive_mean_wheelchair_evacuation_time_sec=adapt_wc_mean,
        mean_wheelchair_time_difference_sec=wc_diff_mean,
        avg_trial_runtime_ms=avg_trial_ms,
        total_benchmark_wall_sec=round(total_wall_sec, 3),
        peak_memory_mb=round(peak_memory_mb, 2),
        peak_python_heap_mb=round(peak_memory_mb, 2),
        peak_process_rss_mb=round(peak_process_rss_mb, 2),
        evidence_tier=evidence_tier,
        uncertainty_note=uncertainty_note,
    )
