import time
from app.simulation.engine import SimulationEngine
from app.simulation.scenarios import build_university_hall_scenario

def run_benchmark():
    scenario = build_university_hall_scenario()
    print(f"Benchmarking 250-agent simulation on '{scenario.name}'...")
    
    start_time = time.perf_counter()
    engine = SimulationEngine(
        scenario_config=scenario,
        seed=101,
        occupant_count_override=250,
        max_time_sec=180.0
    )
    init_time = time.perf_counter() - start_time
    print(f"Engine initialization time: {init_time * 1000:.2f} ms")

    step_times = []
    total_steps = 0
    sim_start = time.perf_counter()

    while engine.status != "completed" and total_steps < 200:
        t0 = time.perf_counter()
        engine.step(dt=0.5)
        t1 = time.perf_counter()
        step_times.append(t1 - t0)
        total_steps += 1

    total_sim_wall_time = time.perf_counter() - sim_start
    avg_step_ms = (sum(step_times) / max(1, len(step_times))) * 1000.0

    print("--- Benchmark Results ---")
    print(f"Total simulated time: {engine.current_time_sec:.1f} s")
    print(f"Total steps executed: {total_steps}")
    print(f"Total wall-clock time: {total_sim_wall_time:.3f} s")
    print(f"Average step execution time: {avg_step_ms:.2f} ms ({1000.0 / avg_step_ms:.1f} steps/sec)")
    print(f"Evacuation completion: {engine.metrics.completion_percentage}% ({engine.metrics.total_evacuated}/{engine.metrics.total_occupants})")
    print(f"Peak local crowd density: {engine.metrics.max_crowd_density} pers/m²")
    print(f"Peak exit queue length: {engine.metrics.max_exit_queue_length} persons")

if __name__ == "__main__":
    run_benchmark()
