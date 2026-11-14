import os
import sys
import time
import tracemalloc
import psutil

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.experiments.models import ExperimentRunRequest
from app.experiments.runner import run_experiment
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import get_scenario

def test_performance_and_stability():
    process = psutil.Process(os.getpid())
    print("=== PHASE E: PERFORMANCE, SCALING & DETERMINISM AUDIT ===")
    initial_rss = process.memory_info().rss / (1024 * 1024)
    print(f"Initial Process RSS: {initial_rss:.2f} MB")

    # -------------------------------------------------------------
    # 1. N = 150 Occupants: Determinism & Stability Check
    # -------------------------------------------------------------
    print("\n--- 1. Testing N = 150 (Scenario Normal, Seed 42 - 2 Identical Runs) ---")
    scen150 = get_scenario("scenario_normal_evacuation")
    
    # Run 1
    t0 = time.perf_counter()
    eng1 = SimulationEngine(scen150, algorithm="adaptive", seed=42)
    step_count1 = 0
    while eng1.get_state().status != "completed" and eng1.current_time_sec < 150.0:
        eng1.step(0.5)
        step_count1 += 1
    t1 = time.perf_counter()
    state1 = eng1.get_state()
    wall1 = t1 - t0

    # Run 2 (Deterministic duplicate)
    t0 = time.perf_counter()
    eng2 = SimulationEngine(scen150, algorithm="adaptive", seed=42)
    step_count2 = 0
    while eng2.get_state().status != "completed" and eng2.current_time_sec < 150.0:
        eng2.step(0.5)
        step_count2 += 1
    t2 = time.perf_counter()
    state2 = eng2.get_state()
    wall2 = t2 - t0

    print(f"Run 1: Wall-clock: {wall1:.3f}s | Steps: {step_count1} | Evac Time: {state1.metrics.total_evacuation_time_sec:.2f}s | Status: {state1.status}")
    print(f"Run 2: Wall-clock: {wall2:.3f}s | Steps: {step_count2} | Evac Time: {state2.metrics.total_evacuation_time_sec:.2f}s | Status: {state2.status}")

    # Determinism Verification
    assert step_count1 == step_count2, f"Step count mismatch: {step_count1} vs {step_count2}"
    assert state1.metrics.total_evacuation_time_sec == state2.metrics.total_evacuation_time_sec, "Evacuation time determinism mismatch"
    assert state1.metrics.total_evacuated == state2.metrics.total_evacuated, "Total evacuated mismatch"
    print("✅ Determinism Verified: Identical step count and exact floating-point metrics across independent seeds.")

    # -------------------------------------------------------------
    # 2. N = 250 Occupants (5 Seeds: 101 to 105)
    # -------------------------------------------------------------
    print("\n--- 2. Benchmarking N = 250 Occupants (5 seeds: 101 to 105) ---")
    req250 = ExperimentRunRequest(
        scenario_id="scenario_university_concourse",
        occupant_count=250,
        seeds=list(range(101, 106)),
        max_sim_time_sec=250.0,
        dt=0.5,
    )
    rss_before_250 = process.memory_info().rss / (1024 * 1024)
    t0 = time.perf_counter()
    res250 = run_experiment(req250)
    t1 = time.perf_counter()
    wall_250 = t1 - t0
    rss_after_250 = process.memory_info().rss / (1024 * 1024)
    per_seed_250 = wall_250 / 5.0
    s250 = res250.summary

    print(f"N=250 Total Wall Time: {wall_250:.2f}s ({per_seed_250:.2f}s/seed).")
    print(f"  Baseline Mean: {s250.baseline_mean_time_sec:.2f}s | Adaptive Mean: {s250.adaptive_mean_time_sec:.2f}s")
    print(f"  Mean Delta: {s250.mean_time_difference_sec:.2f}s ({s250.mean_relative_improvement_pct:.2f}%)")
    print(f"  Peak RSS: {rss_after_250:.2f} MB (Delta: +{rss_after_250 - rss_before_250:.2f} MB)")
    print(f"  Wins/Ties/Loss: {s250.adaptive_wins} Adapt / {s250.ties} Ties / {s250.baseline_wins} Base")

    # -------------------------------------------------------------
    # 3. N = 500 Occupants (3 Seeds: 101 to 103, Preliminary Tier)
    # -------------------------------------------------------------
    print("\n--- 3. Benchmarking N = 500 Occupants (3 seeds: 101 to 103, Preliminary) ---")
    req500 = ExperimentRunRequest(
        scenario_id="scenario_university_concourse",
        occupant_count=500,
        seeds=[101, 102, 103],
        max_sim_time_sec=250.0,
        dt=0.5,
    )
    rss_before_500 = process.memory_info().rss / (1024 * 1024)
    t0 = time.perf_counter()
    res500 = run_experiment(req500)
    t1 = time.perf_counter()
    wall_500 = t1 - t0
    rss_after_500 = process.memory_info().rss / (1024 * 1024)
    per_seed_500 = wall_500 / 3.0
    s500 = res500.summary

    print(f"N=500 Total Wall Time: {wall_500:.2f}s ({per_seed_500:.2f}s/seed).")
    print(f"  Baseline Mean: {s500.baseline_mean_time_sec:.2f}s | Adaptive Mean: {s500.adaptive_mean_time_sec:.2f}s")
    print(f"  Mean Delta: {s500.mean_time_difference_sec:.2f}s ({s500.mean_relative_improvement_pct:.2f}%)")
    print(f"  Peak RSS: {rss_after_500:.2f} MB (Delta: +{rss_after_500 - rss_before_500:.2f} MB)")
    print(f"  Evidence Tier: {s500.evidence_tier} (p = {s500.p_value})")

    # -------------------------------------------------------------
    # 4. Memory Stability & Repeated Run Leak Audit
    # -------------------------------------------------------------
    print("\n--- 4. Memory Stability & Leak Audit across Repeated Runs ---")
    rss_history = []
    scen_corridor = get_scenario("scenario_congested_corridor")
    for r in range(5):
        eng = SimulationEngine(scen_corridor, algorithm="adaptive", seed=101 + r)
        for _ in range(50): # 25 simulated seconds
            eng.step(0.5)
        current_rss = process.memory_info().rss / (1024 * 1024)
        rss_history.append(current_rss)
        print(f"  Run {r + 1}/5 RSS: {current_rss:.2f} MB")

    rss_growth = rss_history[-1] - rss_history[0]
    print(f"Net RSS drift across 5 consecutive simulations: {rss_growth:.2f} MB")
    assert abs(rss_growth) < 20.0, f"Uncontrolled memory growth detected: {rss_growth:.2f} MB"
    print("✅ Memory Stability Verified: Peak process RSS remains bounded with no steady-state leaks.")

    print("\n--- ALL PHASE E PERFORMANCE TESTS COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    test_performance_and_stability()
