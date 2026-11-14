import time
from app.experiments.models import ExperimentRunRequest
from app.experiments.runner import run_experiment
from app.experiments.exporter import export_to_csv, export_to_json


def benchmark_population_scaling():
    print("=" * 80)
    print("EXIT-ZERO PHASE 4: EXPERIMENTAL PERFORMANCE & MEMORY SCALING BENCHMARK")
    print("=" * 80)

    configs = [
        {"occupants": 100, "seeds": [101, 102, 103, 104, 105]},
        {"occupants": 250, "seeds": [101, 102, 103, 104, 105]},
        {"occupants": 500, "seeds": [101, 102, 103]},
    ]

    scenario_id = "scenario_congested_corridor"

    results_table = []

    for cfg in configs:
        n_occ = cfg["occupants"]
        seeds = cfg["seeds"]
        print(f"\n[BENCHMARK] Testing N = {n_occ} occupants across {len(seeds)} paired seeds...")

        req = ExperimentRunRequest(
            scenario_id=scenario_id,
            occupant_count=n_occ,
            seeds=seeds,
            max_sim_time_sec=250.0,
            dt=0.5,
        )

        t0 = time.perf_counter()

        exp_result = run_experiment(req)

        wall_sec = time.perf_counter() - t0
        s = exp_result.summary
        export_to_json(exp_result, save_dir="experiments")
        export_to_csv(exp_result, save_dir="experiments")

        avg_ms_per_paired_trial = s.avg_trial_runtime_ms
        sec_per_seed = wall_sec / len(seeds)

        res_entry = {
            "occupants": n_occ,
            "seeds_count": len(seeds),
            "total_wall_sec": round(wall_sec, 2),
            "sec_per_seed": round(sec_per_seed, 2),
            "avg_ms_per_trial": avg_ms_per_paired_trial,
            "peak_heap_mb": s.peak_python_heap_mb,
            "peak_rss_mb": s.peak_process_rss_mb,
            "base_mean_time": s.baseline_mean_time_sec,
            "adapt_mean_time": s.adaptive_mean_time_sec,
            "mean_delta_sec": s.mean_time_difference_sec,
            "rel_pct": s.mean_relative_improvement_pct,
            "ci_95": f"[{s.ci_95_lower}, {s.ci_95_upper}]",
            "p_val": s.p_value,
            "wins": f"Adapt: {s.adaptive_wins} / Base: {s.baseline_wins} / Tie: {s.ties}",
        }
        results_table.append(res_entry)

        print(f"  Total Wall Clock: {wall_sec:.2f}s ({sec_per_seed:.2f}s / paired seed)")
        print(f"  Peak Python heap (tracemalloc): {s.peak_python_heap_mb:.2f} MB")
        print(f"  Peak process RSS (sampled): {s.peak_process_rss_mb:.2f} MB")
        print(f"  Baseline Mean: {s.baseline_mean_time_sec}s | Adaptive Mean: {s.adaptive_mean_time_sec}s")
        print(f"  Delta: {s.mean_time_difference_sec}s ({s.mean_relative_improvement_pct}% gain)")
        print(f"  95% Bootstrap CI: [{s.ci_95_lower}, {s.ci_95_upper}] | p-value: {s.p_value}")
        print(f"  Outcomes: Adapt Wins={s.adaptive_wins}, Base Wins={s.baseline_wins}, Ties={s.ties}")

    print("\n" + "=" * 80)
    print("SCALING BENCHMARK SUMMARY TABLE:")
    print(f"{'Occupants':<10} | {'Seeds':<6} | {'Wall (s)':<9} | {'Sec/Seed':<9} | {'Heap MB':<8} | {'RSS MB':<8} | {'Base Mean':<10} | {'Adapt Mean':<10} | {'Delta':<8} | {'p-value':<8}")
    print("-" * 88)
    for r in results_table:
        print(f"{r['occupants']:<10} | {r['seeds_count']:<6} | {r['total_wall_sec']:<9} | {r['sec_per_seed']:<9} | {r['peak_heap_mb']:<8} | {r['peak_rss_mb']:<8} | {r['base_mean_time']}s     | {r['adapt_mean_time']}s    | {r['mean_delta_sec']}s   | {r['p_val']}")
    print("=" * 80)


if __name__ == "__main__":
    benchmark_population_scaling()
