import csv
import io
import json
import os
from typing import Optional

from app.experiments.models import ExperimentResult


def export_to_csv(result: ExperimentResult, save_dir: Optional[str] = None) -> str:
    """
    Exports paired trial outcomes and summary statistics to RFC 4180 CSV string.
    Optionally persists to disk in save_dir.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # 1. Header Metadata
    writer.writerow(["# EXIT-ZERO Experimental Benchmark Export"])
    writer.writerow(["# Scenario ID", result.scenario_id])
    writer.writerow(["# Scenario Name", result.scenario_name])
    writer.writerow(["# Occupants (N)", result.occupant_count])
    writer.writerow(["# Sample Size (Seeds)", len(result.seeds)])
    writer.writerow(["# Evidence Tier", result.summary.evidence_tier])
    writer.writerow(["# Uncertainty Note", result.summary.uncertainty_note])
    writer.writerow(["# Timestamp", result.timestamp])
    writer.writerow([])

    # 2. Summary Statistics
    s = result.summary
    writer.writerow(["SUMMARY_STATISTICS"])
    writer.writerow(["Metric", "Baseline", "Adaptive (EXIT-ZERO)", "Delta (Baseline - Adapt)", "Relative % Improvement"])
    writer.writerow([
        "Mean Total Evacuation Time (s)",
        s.baseline_mean_time_sec,
        s.adaptive_mean_time_sec,
        s.mean_time_difference_sec,
        f"{s.mean_relative_improvement_pct}%" if s.mean_relative_improvement_pct is not None else "N/A"
    ])
    writer.writerow([
        "Median Total Evacuation Time (s)",
        s.baseline_median_time_sec,
        s.adaptive_median_time_sec,
        s.median_time_difference_sec,
        "N/A"
    ])
    writer.writerow([
        "Std Dev Evacuation Time (s)",
        s.baseline_std_time_sec,
        s.adaptive_std_time_sec,
        "N/A",
        "N/A"
    ])
    writer.writerow(["95% Bootstrap CI for Delta (s)", "", "", f"[{s.ci_95_lower}, {s.ci_95_upper}]", ""])
    writer.writerow(["Permutation Test p-value", "", "", s.p_value, "Statistically Significant: YES" if s.is_statistically_significant else "Statistically Significant: NO"])
    writer.writerow(["Wins / Losses / Ties", f"Baseline Wins: {s.baseline_wins}", f"Adaptive Wins: {s.adaptive_wins}", f"Ties: {s.ties}", ""])
    writer.writerow(["Mean Peak Queue Reduction", "", "", s.mean_peak_queue_reduction, "occupants"])
    writer.writerow(["Mean Peak Density Reduction", "", "", s.mean_peak_density_reduction, "pers/m²"])
    writer.writerow(["Mean Waiting Time Reduction", "", "", s.mean_waiting_time_reduction_sec, "seconds"])
    writer.writerow(["Mean Hazard Exposure Reduction", "", "", s.mean_hazard_exposure_reduction, "dosage"])
    writer.writerow(["Mean Adaptive Reroutes", "", "", s.mean_adaptive_reroutes, "reroutes/trial"])
    writer.writerow([
        "Mean Wheelchair Evacuation Time (s)",
        s.baseline_mean_wheelchair_evacuation_time_sec,
        s.adaptive_mean_wheelchair_evacuation_time_sec,
        s.mean_wheelchair_time_difference_sec,
        "positive delta favors EXIT-ZERO",
    ])
    writer.writerow(["Total Wall Benchmark Time (s)", "", "", s.total_benchmark_wall_sec, ""])
    writer.writerow(["Peak Python Heap (MB, tracemalloc)", "", "", s.peak_python_heap_mb, ""])
    writer.writerow(["Peak Process RSS (MB, sampled)", "", "", s.peak_process_rss_mb, ""])
    writer.writerow(["Memory Measurement Note", "", "", s.memory_measurement_note, ""])
    writer.writerow([])

    # 3. Per-Seed Trials Table
    writer.writerow(["PER_SEED_TRIAL_DATA"])
    writer.writerow([
        "Seed",
        "Winner",
        "Base_Evac_Time_s",
        "Adapt_Evac_Time_s",
        "Delta_Time_s",
        "Rel_Time_Imp_Pct",
        "Base_Median_Time_s",
        "Adapt_Median_Time_s",
        "Base_Peak_Queue",
        "Adapt_Peak_Queue",
        "Delta_Peak_Queue",
        "Base_Peak_Density",
        "Adapt_Peak_Density",
        "Delta_Peak_Density",
        "Base_Wait_Time_s",
        "Adapt_Wait_Time_s",
        "Base_Hazard_Exposure",
        "Adapt_Hazard_Exposure",
        "Adapt_Reroutes",
        "Base_Wheelchair_Mean_Evac_Time_s",
        "Adapt_Wheelchair_Mean_Evac_Time_s",
        "Delta_Wheelchair_Mean_Evac_Time_s",
        "Base_Wall_ms",
        "Adapt_Wall_ms",
        "Peak_Process_RSS_MB",
    ])

    for t in result.trials:
        writer.writerow([
            t.seed,
            t.winner,
            t.baseline_metrics.total_evacuation_time_sec,
            t.adaptive_metrics.total_evacuation_time_sec,
            t.diff_evacuation_time_sec,
            t.relative_time_improvement_pct,
            t.baseline_metrics.median_evacuation_time_sec,
            t.adaptive_metrics.median_evacuation_time_sec,
            t.baseline_metrics.max_exit_queue_length,
            t.adaptive_metrics.max_exit_queue_length,
            t.diff_peak_queue,
            t.baseline_metrics.max_crowd_density,
            t.adaptive_metrics.max_crowd_density,
            t.diff_peak_density,
            t.baseline_metrics.mean_waiting_time_sec,
            t.adaptive_metrics.mean_waiting_time_sec,
            t.baseline_metrics.cumulative_hazard_exposure,
            t.adaptive_metrics.cumulative_hazard_exposure,
            t.adaptive_metrics.total_reroutes or 0,
            t.baseline_metrics.mean_wheelchair_evacuation_time_sec,
            t.adaptive_metrics.mean_wheelchair_evacuation_time_sec,
            t.diff_wheelchair_mean_evacuation_time_sec,
            t.baseline_wall_time_ms,
            t.adaptive_wall_time_ms,
            t.peak_process_rss_mb,
        ])

    csv_text = output.getvalue()

    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, f"experiment_{result.scenario_id}_{result.occupant_count}_{result.job_id}.csv")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(csv_text)

    return csv_text


def export_to_json(result: ExperimentResult, save_dir: Optional[str] = None) -> str:
    """
    Exports complete experimental results to JSON string.
    Optionally persists to disk in save_dir.
    """
    json_text = result.model_dump_json(indent=2)
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, f"experiment_{result.scenario_id}_{result.occupant_count}_{result.job_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_text)
    return json_text
