import time
from app.models.scenario import AlgorithmType
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import build_scenario_a_sudden_exit_closure, build_scenario_b_congested_corridor


def run_comparative_benchmark(scenario_builder, name: str, occupant_count: int = 250):
    scenario = scenario_builder()
    print("=" * 70)
    print(f"BENCHMARK: {name} (N = {occupant_count} occupants)")
    print("=" * 70)

    results = {}

    for algo in [AlgorithmType.BASELINE, AlgorithmType.ADAPTIVE]:
        print(f"\nRunning {algo.value.upper()} on '{scenario.name}'...")
        t_init_start = time.perf_counter()
        engine = SimulationEngine(
            scenario_config=scenario,
            algorithm=algo,
            seed=42,
            occupant_count_override=occupant_count,
            max_time_sec=300.0,
        )
        init_time_ms = (time.perf_counter() - t_init_start) * 1000.0

        step_times = []
        sim_start = time.perf_counter()

        while engine.status != "completed" and engine.step_count < 400:
            t0 = time.perf_counter()
            engine.step(dt=0.5)
            t1 = time.perf_counter()
            step_times.append(t1 - t0)

        total_wall_sec = time.perf_counter() - sim_start
        avg_step_ms = (sum(step_times) / max(1, len(step_times))) * 1000.0
        steps_per_sec = 1000.0 / max(0.001, avg_step_ms)

        state = engine.get_state()
        m = state.metrics

        total_exposure = sum(o.hazard_exposure for o in engine.occupants)

        results[algo.value] = {
            "init_time_ms": init_time_ms,
            "total_wall_sec": total_wall_sec,
            "avg_step_ms": avg_step_ms,
            "steps_per_sec": steps_per_sec,
            "steps_count": engine.step_count,
            "sim_time_sec": engine.current_time_sec,
            "evacuated": m.total_evacuated,
            "total": m.total_occupants,
            "completion_pct": m.completion_percentage,
            "peak_density": m.max_crowd_density,
            "peak_queue": m.max_exit_queue_length,
            "total_reroutes": m.total_reroutes,
            "median_evac_time": m.median_evacuation_time_sec or 0.0,
            "mean_waiting_time": m.mean_waiting_time_sec,
            "total_exposure": total_exposure,
        }

        print(f"  Execution: {engine.step_count} steps in {total_wall_sec:.3f}s (Avg: {avg_step_ms:.2f} ms/step, {steps_per_sec:.0f} steps/s)")
        print(f"  Evacuation: {m.total_evacuated}/{m.total_occupants} ({m.completion_percentage:.1f}%) in {engine.current_time_sec:.1f} sim-seconds")
        print(f"  Median Evac Time: {m.median_evacuation_time_sec or 0.0:.1f}s | Wait Time: {m.mean_waiting_time_sec:.1f}s")
        print(f"  Peak Queue: {m.max_exit_queue_length} | Peak Density: {m.max_crowd_density:.2f} pers/m²")
        print(f"  Reroutes Logged: {m.total_reroutes} | Total Hazard Exposure: {total_exposure:.2f}")

    # Comparative summary
    base = results["baseline"]
    adapt = results["adaptive"]
    print("\n--- COMPARATIVE SUMMARY ---")
    print(f"Evacuation Time: Baseline {base['sim_time_sec']:.1f}s vs Adaptive {adapt['sim_time_sec']:.1f}s")
    if base['sim_time_sec'] > 0:
        time_diff = ((base['sim_time_sec'] - adapt['sim_time_sec']) / base['sim_time_sec']) * 100.0
        print(f"Time Delta: {time_diff:+.1f}% ({'FASTER' if time_diff > 0 else 'SLOWER'})")
    print(f"Peak Exit Queue: Baseline {base['peak_queue']} vs Adaptive {adapt['peak_queue']}")
    print(f"Peak Crowd Density: Baseline {base['peak_density']:.2f} vs Adaptive {adapt['peak_density']:.2f} pers/m²")
    print(f"Compute Overhead: Baseline {base['avg_step_ms']:.2f} ms vs Adaptive {adapt['avg_step_ms']:.2f} ms per step")
    print("=" * 70 + "\n")
    return results


if __name__ == "__main__":
    # Test on Scenario A (Sudden Exit Closure)
    res_a = run_comparative_benchmark(build_scenario_a_sudden_exit_closure, "Scenario A: Sudden Exit Closure", occupant_count=250)
    # Test on Scenario B (Congested Corridor)
    res_b = run_comparative_benchmark(build_scenario_b_congested_corridor, "Scenario B: Congested Central Corridor", occupant_count=250)
