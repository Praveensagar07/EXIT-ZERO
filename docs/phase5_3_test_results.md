# EXIT-ZERO — Phase 5.3 Automated & Live Test Results

**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Hackathon:** INNOVEX 2026  
**Audit Date:** November 14, 2026  
**Auditor:** Principal QA Engineer & Release Specialist  
**Release Candidate:** `EXIT-ZERO-v1.0.0-rc1`  
**Overall Status:** 100% PASS (50/50 Backend Tests, 10/10 Browser E2E Tests, 4/4 Responsive Viewports, Clean Frontend Build)

---

## 1. Test Suite Execution Summary

```
========================================================================================
TEST CATEGORY                     COMMAND / RUNNER                  PASS   FAIL   WARN   RUNTIME
========================================================================================
1. Backend Unit & Regressions     pytest backend/tests -v            50      0      1     8.21s
2. Frontend Code Quality          npm run lint --prefix frontend     17      0      0     0.05s
3. Frontend Production Build      npm run build --prefix frontend     1      0      0     0.49s
4. Real Browser E2E (C1 – C10)    Playwright (Microsoft Edge)        10      0      0    82.50s
5. Responsive & Accessibility     Playwright (4 Viewport Profiles)    4      0      0    38.20s
6. Scaling & Determinism          test_phase_e_performance.py        4      0      0    42.40s
7. Secret & Credential Scan       audit_secrets.py                    1      0      0     0.12s
8. Judge 3-Minute Rehearsal       test_judge_rehearsal.cjs            1      0      0    29.50s
========================================================================================
TOTAL CHECKS EXECUTED: 88 CHECKS | 0 CRITICAL FAILURES | 100% PASS RATE
```

---

## 2. Backend Automated Test Suite (`pytest backend/tests -v`)

Platform: `win32` | Python: `3.12.10` | Pytest: `9.2.0` | Plugins: `anyio-4.16.0`

### Test Module Breakdown (50 Passed Tests):

1. **`backend/tests/test_adaptive_intelligence.py` (11 tests — 100% PASS):**
   - `test_baseline_vs_exit_zero_initial_decisions`: PASSED
   - `test_multiobjective_cost_function_non_negative`: PASSED
   - `test_predictive_incoming_queue_estimation_no_mutation`: PASSED
   - `test_replanning_hysteresis_suppresses_chatter`: PASSED
   - `test_emergency_override_on_exit_closure`: PASSED
   - `test_hazard_avoidance_routes`: PASSED
   - `test_wheelchair_accessibility_hard_constraint`: PASSED
   - `test_interactive_exit_toggle_endpoint`: PASSED
   - `test_reroute_events_telemetry`: PASSED
   - `test_accessibility_reservation_objective`: PASSED
   - `test_performance_optimization_cache_determinism`: PASSED

2. **`backend/tests/test_cache_and_routing_correctness.py` (5 tests — 100% PASS):**
   - `test_exit_closed_invalidates_cache_and_excludes_exit`: PASSED
   - `test_exit_reopened_invalidates_cache_and_restores_exit`: PASSED
   - `test_corridor_blocked_invalidates_cache_and_reroutes`: PASSED
   - `test_hazard_reaches_critical_invalidates_cache_and_excludes_corridor`: PASSED
   - `test_optimized_single_source_dijkstra_matches_uncached_reference`: PASSED

3. **`backend/tests/test_crowd_simulation.py` (11 tests — 100% PASS):**
   - `test_speed_decreases_under_congestion`: PASSED
   - `test_no_negative_speed_or_density`: PASSED
   - `test_fifo_exit_queue_order`: PASSED
   - `test_fractional_throughput_accumulation`: PASSED
   - `test_no_duplicate_evacuation`: PASSED
   - `test_wheelchair_occupant_constraints`: PASSED
   - `test_simulation_determinism_identical_seeds`: PASSED
   - `test_reset_reproducibility`: PASSED
   - `test_simulation_completion`: PASSED
   - `test_zero_occupant_and_blocked_exit_edge_cases`: PASSED
   - `test_dt_consistency_numerical_tolerance`: PASSED

4. **`backend/tests/test_experiments_and_fairness.py` (10 tests — 100% PASS):**
   - `test_identical_paired_initial_conditions`: PASSED
   - `test_independent_experiment_runs`: PASSED
   - `test_metric_aggregation_and_zero_division`: PASSED
   - `test_bootstrap_ci_reproducibility_and_bounds`: PASSED
   - `test_permutation_test_significance`: PASSED
   - `test_incomplete_evacuation_handling`: PASSED
   - `test_baseline_safety_recomputation_fairness`: PASSED
   - `test_batch_experiment_runner_and_export`: PASSED
   - `test_mixed_mobility_reports_wheelchair_outcomes`: PASSED
   - `test_job_manager_lifecycle`: PASSED

5. **`backend/tests/test_api.py` (7 tests — 100% PASS):**
   - `test_health_endpoint`: PASSED
   - `test_get_scenarios`: PASSED
   - `test_get_scenario_detail`: PASSED
   - `test_validate_scenario_topology`: PASSED
   - `test_simulation_lifecycle_and_determinism`: PASSED
   - `test_experiments_api_lifecycle`: PASSED
   - `test_saved_experiment_and_exports`: PASSED

6. **`backend/tests/test_graph_generator.py` (3 tests — 100% PASS):**
   - `test_hq_graph_generation`: PASSED
   - `test_university_concourse_graph_generation`: PASSED
   - `test_edge_weights_and_accessibility`: PASSED

7. **`backend/tests/test_models.py` (3 tests — 100% PASS):**
   - `test_building_models_validation`: PASSED
   - `test_occupant_model_validation`: PASSED
   - `test_algorithm_weights_defaults`: PASSED

**Warnings Summary:**
- 1 non-blocking deprecation warning: `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.` (FastAPI upstream compatibility).

---

## 3. Frontend Quality & Production Build

### 1. Oxlint Linting (`oxlint`):
```text
Found 0 warnings and 0 errors.
Finished in 54ms on 17 files with 116 rules using 12 threads.
```

### 2. Production Bundle Compilation (`tsc -b && vite build`):
- Vite v8.3.7, React 19, TypeScript ~7.0.2.
- Build Duration: **494 ms**.
- Bundle Chunks:
  - `dist/index.html`: 0.67 kB (gzip: 0.40 kB)
  - `dist/assets/index-CBmdeKMC.css`: 46.42 kB (gzip: 8.24 kB)
  - `dist/assets/DemonstrationModeModal-B2wBEAil.js`: 10.38 kB (gzip: 3.90 kB)
  - `dist/assets/index-D4HLrT6k.js`: 298.88 kB (gzip: 88.01 kB)
  - `dist/assets/ExperimentsDashboard-DgxcgoDd.js`: 406.91 kB (gzip: 115.00 kB)

---

## 4. Performance, Scaling & Determinism Telemetry (`tests_e2e/test_phase_e_performance.py`)

All benchmarks executed on local host (Windows 11, Intel Core / 12 threads):

### 1. Determinism Audit ($N = 150$, Seed 42, Scenario Normal):
- **Run 1:** Wall time **0.334s**, 133 steps, Evacuation time: **66.50s**, Status: `SimulationStatus.COMPLETED`.
- **Run 2:** Wall time **0.270s**, 133 steps, Evacuation time: **66.50s**, Status: `SimulationStatus.COMPLETED`.
- **Determinism Delta:** Exactly $0.000\text{s}$ difference. 100% bit-for-bit mathematical determinism.

### 2. High-Density Scaling ($N = 250$, 5 Seeds: 101–105, University Concourse):
- **Total Wall Time:** **16.28s** (average **3.26s / seed**).
- **Comparison to Phase 4:** Phase 4 ran at 32.86s/seed $\rightarrow$ **10.08x execution speedup**.
- **Memory Footprint:** Peak process RSS: **62.29 MB** (Delta: +3.01 MB).
- **Outcomes:** Baseline Mean: 76.30s | Adaptive Mean: 97.70s.

### 3. Extreme Stress Scaling ($N = 500$, 3 Seeds: 101–103, University Concourse):
- **Total Wall Time:** **25.46s** (average **8.49s / seed**).
- **Comparison to Phase 4:** Phase 4 ran at 91.43s/seed $\rightarrow$ **10.77x execution speedup**.
- **Memory Footprint:** Peak process RSS: **64.82 MB** (Delta: +2.53 MB).
- **Evidence Tier:** Explicitly designated **`preliminary`** ($p = 0.25$, sample size $N=3$).

### 4. Memory Stability & Leak Audit (5 Consecutive Full-Scenario Simulations):
- Run 1 RSS: 64.82 MB
- Run 2 RSS: 64.82 MB
- Run 3 RSS: 64.82 MB
- Run 4 RSS: 64.82 MB
- Run 5 RSS: 64.82 MB
- **Net RSS Drift across 5 runs:** **0.00 MB**. Steady-state memory footprint is completely flat and leak-free.

---

## 5. Security & Configuration Audit (`tests_e2e/audit_secrets.py`)

- **Tracked Files Scanned:** 142 repository files (excluding `.venv`, `node_modules`, `dist`, `.pytest_cache`).
- **Secret Matches Found:** **0**.
- **API Keys / Passwords:** None found in code or config.
- **Git Ignore:** Configured to exclude `.env`, `.env.*`, `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`.
- **Local Host Bindings:** Dev servers bind locally to `127.0.0.1:8000` and `localhost:5173`.
