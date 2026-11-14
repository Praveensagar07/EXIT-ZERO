import os
from app.experiments.exporter import export_to_csv, export_to_json
from app.experiments.models import ExperimentRunRequest
from app.experiments.runner import run_experiment

def run_phase5_accessibility_sweep():
    os.makedirs("experiments", exist_ok=True)
    seeds_20 = list(range(101, 121)) # exact same 20 paired seeds

    print("\n[PHASE 5.1 SWEEP] Running official 20-seed evaluation on Scenario D: Mixed Mobility with Accessibility Reservation...")
    req = ExperimentRunRequest(
        scenario_id="scenario_mixed_mobility",
        occupant_count=140,
        seeds=seeds_20,
        max_sim_time_sec=250.0,
        dt=0.5,
    )

    result = run_experiment(req)
    s = result.summary

    # Save to versioned V2 files without overwriting historical original
    csv_path = os.path.join("experiments", "benchmark_scenario_mixed_mobility_N140_20seeds_v2.csv")
    json_path = os.path.join("experiments", "benchmark_scenario_mixed_mobility_N140_20seeds_v2.json")

    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(export_to_csv(result))

    with open(json_path, "w", encoding="utf-8") as f:
        f.write(export_to_json(result))

    print(f"  Complete: {len(result.trials)} paired trials executed in {s.total_benchmark_wall_sec:.2f}s.")
    print(f"  Baseline Mean: {s.baseline_mean_time_sec}s | Adaptive Mean: {s.adaptive_mean_time_sec}s")
    print(f"  Mean Delta: {s.mean_time_difference_sec}s ({s.mean_relative_improvement_pct}% gain)")
    print(f"  95% Bootstrap CI: [{s.ci_95_lower}, {s.ci_95_upper}] s")
    print(f"  Permutation p-value: {s.p_value} (Significant: {s.is_statistically_significant})")
    print(f"  Outcomes: Adaptive Wins={s.adaptive_wins}, Baseline Wins={s.baseline_wins}, Ties={s.ties}")
    print(f"  Saved CSV -> {csv_path}")
    print(f"  Saved JSON -> {json_path}")

if __name__ == "__main__":
    run_phase5_accessibility_sweep()
