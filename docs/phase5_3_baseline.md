# EXIT-ZERO — Phase 5.3 Repository Baseline Report

**Timestamp:** 2026-11-12T15:07:00+05:30  
**Workspace:** `C:\Users\PRAVEENRAJ\Desktop\Exit zero`  
**Phase:** Phase 5.3 — Phase A Repository Baseline  

---

## 1. Repository & Version Control State

- **Git Initialization:** Not initialized (`.git` directory is absent at workspace root; `git status` exits with code 1). No commit hash or local tags exist prior to Phase 5.3.
- **Ignore Rules:** `frontend/.gitignore` exists; root `.gitignore` is currently absent.
- **Directory Layout:** Clean monorepo containing `backend/`, `frontend/`, `docs/`, `experiments/`, `scenarios/`, `submission/`, and `README.md`.

---

## 2. Environment & Dependency Baseline

### Backend (`backend/.venv` — Python 3.14.7)
- `fastapi==0.162.2`
- `uvicorn==0.54.0`
- `pydantic==2.14.3`
- `networkx==3.7`
- `numpy==2.5.4`
- `pytest==9.2.0`
- `httpx==0.28.1`
- `psutil==7.2.2`

### Frontend (`frontend/package.json` — Node v24.19.0 / npm 11.17.0)
- `react@^19.3.1`, `react-dom@^19.3.1`
- `recharts@^3.10.1`
- `lucide-react@^1.71.0`
- `tailwindcss@^4.3.5`, `@tailwindcss/vite@^4.3.5`
- `vite@^8.3.6`, `typescript@~7.0.2`, `oxlint@^1.90.0`

---

## 3. Documented Startup & Verification Commands

- **Backend Daemon:**
  ```powershell
  $env:PYTHONPATH = "backend"
  backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
  ```
- **Frontend Dev Server (Proxies `/api` -> `http://localhost:8000`):**
  ```powershell
  npm run dev --prefix frontend
  ```
- **Automated Checks:**
  - Backend Tests: `backend\.venv\Scripts\pytest backend/tests -v` (Baseline: 49 passing tests)
  - Frontend Lint: `npm run lint --prefix frontend` (`oxlint`: 0 warnings, 0 errors across 17 files)
  - Frontend Build: `npm run build --prefix frontend` (`tsc -b && vite build`)

---

## 4. Verified Source Experiment Artifacts (`experiments/`)

Exact summary values audited directly from JSON artifacts prior to browser testing:

1. **Scenario B — Congested Corridor (`benchmark_scenario_congested_corridor_N200_20seeds.json`):**
   - `sample_size`: 20 (`completed_sample_size`: 20)
   - `baseline_mean_time_sec`: `84.45` (median `83.25`, std `4.77`)
   - `adaptive_mean_time_sec`: `72.92` (median `74.25`, std `9.26`)
   - `mean_time_difference_sec`: `11.53` (`13.65%`)
   - `ci_95`: `[6.5, 16.6]`, `p_value`: `0.0001` (`is_statistically_significant: true`)
   - Outcomes: `16` adaptive wins / `3` baseline wins / `1` tie
   - `peak_memory_mb` (legacy tracemalloc heap): `2.06 MB`
2. **Scenario D — Mixed Mobility V1 (`benchmark_scenario_mixed_mobility_N140_20seeds.json`):**
   - Total: Baseline `68.9s` vs Adaptive `70.47s` (`-1.57s`, `-2.28%`, `p = 0.0078`)
   - Wheelchair mean: Baseline `48.44s` vs Adaptive `49.08s` (`-0.64s`)
   - Wins/Ties: `0` adaptive wins / `8` baseline wins / `12` ties
3. **Scenario D — Mixed Mobility V2 (`benchmark_scenario_mixed_mobility_N140_20seeds_v2.json`):**
   - Total: Baseline `68.9s` vs Adaptive `69.83s` (`-0.93s`, `-1.35%`, `95% CI [-1.52, -0.42]`, `p = 0.001`)
   - Wheelchair mean: Baseline `48.44s` vs Adaptive `48.62s` (`-0.18s`)
   - Wins/Ties: `0` adaptive wins / `6` baseline wins / `14` ties
   - Memory: `peak_python_heap_mb: 3.45`, `peak_process_rss_mb: 64.21`
4. **Scenario B — Extreme Scale 500 Occupants (`benchmark_scenario_congested_corridor_N500_3seeds.json`):**
   - `evidence_tier`: `"preliminary"` (`sample_size`: 3)
   - Baseline `231.83s` vs Adaptive `131.67s` (`100.17s` delta, `43.2%`, `p = 0.25`)
   - Memory: `peak_python_heap_mb: 5.64`, `peak_process_rss_mb: 67.5`

---

## 5. Initial Observations to Verify Live in Phase B & Phase C

1. Check live UI density heatmap & edge state propagation in `App.tsx` (`applyStateUpdate` currently skips `setGraph(state.graph)`).
2. Check live hazard radius rendering over time in `FloorPlanViewport.tsx`.
3. Check `ExperimentsDashboard.tsx` initial state (whether saved Scenario B evidence loads on mount without waiting for a full 20-seed live run).
4. Check `DemonstrationModeModal.tsx` async timing when chaining scenario load + start playback, and align reported figures in docs/UI with verified JSON summaries (`84.45s`, `72.92s`, `11.53s`, `13.65%`).
5. Check UI rendering & accessibility across desktop, laptop, tablet, and mobile viewports.
