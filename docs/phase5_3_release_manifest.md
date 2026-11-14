# EXIT-ZERO — Phase 5.3 Official Release Manifest

**Release Candidate Identifier:** `EXIT-ZERO-v1.0.0-rc1`  
**Target Event:** INNOVEX 2026 Hackathon  
**Release Date:** November 14, 2026  
**Engineering Leads:** Simulation Reliability Specialist, QA Lead, Full-Stack Release Engineer  
**Release Candidate Status:** **FROZEN & VERIFIED** (Pending deployment in Phase 6)

---

## 1. Release Identification & Version Control

- **Release Tag Candidate:** `EXIT-ZERO-v1.0.0-rc1`
- **Workspace Path:** `C:\Users\prave\Desktop\Exit zero`
- **Git State at Freeze:** Local directory (Git uninitialized; no remote push executed, adhering to non-deployment Phase 5.3 instructions).
- **Files Modified in Phase 5.3:**
  - `frontend/src/components/TopNavBar.tsx` (Remediated laptop 1366×768 navbar overlap and pointer interception).
  - `frontend/src/components/ExperimentsDashboard.tsx` (Added accessible form labels for WCAG 2.1 AA compliance).
  - `frontend/src/components/DemonstrationModeModal.tsx` (Added accessible aria-label to close button).
  - `tests_e2e/test_c1_c4.cjs` (End-to-end browser test suite 1).
  - `tests_e2e/test_c5_c8.cjs` (End-to-end browser test suite 2).
  - `tests_e2e/test_c9_c10.cjs` (End-to-end browser test suite 3).
  - `tests_e2e/test_phase_d_responsive.cjs` (Responsive viewport test suite).
  - `tests_e2e/test_phase_e_performance.py` (Scaling, determinism & memory test suite).
  - `tests_e2e/audit_secrets.py` (Credential and secret scanner).
  - `tests_e2e/test_judge_rehearsal.cjs` (Timed 3-minute judge rehearsal).

---

## 2. Dependency Manifest

### Backend Runtime (Python 3.12.10 — `backend/.venv`)
| Package | Version | Purpose |
| :--- | :---: | :--- |
| `fastapi` | 0.162.7 | Asynchronous REST and SSE API server |
| `uvicorn` | 0.54.0 | ASGI web server |
| `pydantic` | 2.14.3 | Data validation and schema enforcement |
| `pydantic-core`| 2.50.4 | High-performance Rust Pydantic core |
| `networkx` | 3.7 | Spatial graph topology, Dijkstra, traversable subgraphs |
| `numpy` | 2.5.4 | Mathematical deceleration models, percentile bootstrap |
| `pytest` | 9.2.0 | Unit and regression test runner |
| `httpx` | 0.28.1 | Synchronous and async HTTP test client |
| `psutil` | 7.2.2 | Operating system process RSS memory sampling |

### Frontend Runtime (Node.js v24.20.0 — `frontend/package.json`)
| Package | Version | Purpose |
| :--- | :---: | :--- |
| `react` | 19.3.1 | Core component framework |
| `react-dom` | 19.3.1 | DOM renderer |
| `recharts` | 3.10.1 | Evidence Lab statistical visualizations |
| `lucide-react` | 1.71.0 | Clean icon library |
| `tailwindcss` | 4.3.5 | Utility-first styling engine |
| `@tailwindcss/vite` | 4.3.5 | Tailwind Vite integration plugin |
| `vite` | 8.3.7 | Frontend bundler and development proxy server |
| `typescript` | ~7.0.2 | Static type checker |
| `oxlint` | 1.90.0 | High-speed Rust linter |
| `playwright` | 1.65.1 | Browser automation for end-to-end verification |

---

## 3. Audited Experimental Evidence Lock

All experimental evidence cited in the release candidate is locked to persisted source records in `experiments/`:

### Principal Benchmark Claim (Scenario B, $N = 200$, 20 Paired Seeds 101–120):
- **Source Artifact:** `experiments/benchmark_scenario_congested_corridor_N200_20seeds.json`
- **Job ID:** `exp_4049e56e`
- **Baseline Mean Evacuation Time:** **84.45 s** (Median: 83.25 s, Std: 4.77 s)
- **EXIT-ZERO Mean Evacuation Time:** **72.92 s** (Median: 74.25 s, Std: 9.26 s)
- **Mean Improvement:** **11.53 s faster (+13.65% relative speedup)**
- **95% Bootstrap Confidence Interval:** **[+6.50 s, +16.60 s]** (strictly positive)
- **Statistical Significance:** Two-tailed paired permutation test $p = 0.0001$ (`is_statistically_significant: true`)
- **Head-to-Head Win Rate:** **16 Adaptive Wins (80%)**, **3 Baseline Wins (15%)**, **1 Tie (5%)**
- **Peak Bottleneck Queue Reduction:** **7.30 occupants** average reduction
- **Peak Crowd Density Reduction:** **0.31 pers/m²** average reduction
- **Peak Memory:** Python Heap **2.06 MB** (`tracemalloc`)

### Mixed-Mobility Benchmark (Scenario D, $N = 140$, 20 Paired Seeds 101–120):
- **Source Artifact:** `experiments/benchmark_scenario_mixed_mobility_N140_20seeds_v2.json`
- **Total Evacuation Time:** Baseline Mean **68.90 s** vs Adaptive Mean **69.83 s** (Delta: -0.93 s / -1.35%, 95% CI [-1.52, -0.42] s)
- **Wheelchair Evacuation Time:** Baseline Mean **48.44 s** vs Adaptive Mean **48.62 s** (Delta: -0.18 s)
- **Safety Record:** **0 trapped occupants**, **0 inaccessible route violations** across 100% of trials
- **Documented Trade-off:** Ramps provide direct ground-floor egress. Over-reserving ambulatory paths into narrow stairwells causes minor stair bottlenecks. Setting `w_accessibility_reservation = 0.0` default resolves this queue inflation.

### Extreme Scale Benchmark (Scenario B, $N = 500$, 3 Seeds 101–103, Preliminary):
- **Source Artifact:** `experiments/benchmark_scenario_congested_corridor_N500_3seeds.json`
- **Baseline Mean:** 231.83 s | **Adaptive Mean:** 131.67 s | **Delta:** +100.17 s (+43.2%)
- **Status:** Explicitly designated **`preliminary`** ($p = 0.25$, sample size $N=3$).

---

## 4. Quality Assurance Summary & Sign-off

- **Backend Automated Tests:** 50 passing tests across 6 test modules in 8.21s.
- **Frontend Quality:** 0 lint errors (17 files), clean production build in 494ms.
- **Browser Acceptance:** 10/10 tests passed (C1 through C10) in headless Edge.
- **Responsive Viewports:** Desktop (1920×1080), Laptop (1366×768), Tablet (768×1024), Mobile (390×844) validated.
- **Judge Walkthrough:** 6 steps executed in 29.5s live runtime (within 180s target).
- **Security Audit:** 0 hardcoded secrets or credentials in repository.
- **Determinism:** Bit-for-bit exact reproduction on repeated identical seeds.

**Release Verdict:** **FREEZE APPROVED (EXIT-ZERO-v1.0.0-rc1)**
