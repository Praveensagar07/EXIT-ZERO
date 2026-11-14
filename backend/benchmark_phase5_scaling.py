import os
import time
import numpy as np
from app.experiments.models import ExperimentRunRequest
from app.experiments.runner import run_experiment
from app.simulation.scenarios import build_university_hall_scenario

def benchmark_scaling():
    print("=== PHASE 5.1 SCALING BENCHMARK (OPTIMIZED ENGINE) ===")
    
    # 250 occupants across 5 seeds (101 to 105)
    print("\n--- Benchmarking N = 250 (5 seeds: 101 to 105) ---")
    req250 = ExperimentRunRequest(
        scenario_id="scenario_university_concourse",
        occupant_count=250,
        seeds=list(range(101, 106)),
        max_sim_time_sec=250.0,
        dt=0.5,
    )
    t0 = time.perf_counter()
    res250 = run_experiment(req250)
    t1 = time.perf_counter()
    s250 = res250.summary
    print(f"N=250: 5 seeds executed in {t1 - t0:.2f}s (was 164.28s in Phase 4!).")
    print(f"  Sec / Seed: {(t1 - t0) / 5:.2f}s (was 32.86s).")
    print(f"  Baseline Mean: {s250.baseline_mean_time_sec}s | Adaptive Mean: {s250.adaptive_mean_time_sec}s | Delta: {s250.mean_time_difference_sec}s ({s250.mean_relative_improvement_pct}%)")

    # 500 occupants across 3 seeds (101 to 103)
    print("\n--- Benchmarking N = 500 (Preliminary: 3 seeds: 101 to 103) ---")
    req500 = ExperimentRunRequest(
        scenario_id="scenario_university_concourse",
        occupant_count=500,
        seeds=[101, 102, 103],
        max_sim_time_sec=250.0,
        dt=0.5,
    )
    t0 = time.perf_counter()
    res500 = run_experiment(req500)
    t1 = time.perf_counter()
    s500 = res500.summary
    print(f"N=500: 3 seeds executed in {t1 - t0:.2f}s (was 274.29s in Phase 4!).")
    print(f"  Sec / Seed: {(t1 - t0) / 3:.2f}s (was 91.43s).")
    print(f"  Baseline Mean: {s500.baseline_mean_time_sec}s | Adaptive Mean: {s500.adaptive_mean_time_sec}s | Delta: {s500.mean_time_difference_sec}s ({s500.mean_relative_improvement_pct}%)")

if __name__ == "__main__":
    benchmark_scaling()
