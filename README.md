# EXIT-ZERO

**Adaptive emergency evacuation digital twin — INNOVEX 2026 research prototype**

EXIT-ZERO compares conventional safety-aware shortest-path evacuation with predictive, congestion-aware routing inside the same deterministic crowd simulator. The system combines a FastAPI simulation engine with a React operations console, reproducible paired-seed experiments, and CSV/JSON evidence exports.

> EXIT-ZERO is a research simulation. It is not a certified life-safety system, fire model, crowd-injury model, or substitute for evacuation engineering and emergency services.

## What is working

- Deterministic occupant generation and replay from a random seed.
- Continuous speed-density deceleration and capacity-limited FIFO exit queues.
- Baseline shortest-path routing that reacts when a physical exit becomes unavailable.
- EXIT-ZERO multi-objective routing with congestion inflow lookahead, hazard costs, accessibility constraints, replanning cadence, and hysteresis.
- Interactive floor plan with live occupants, routes, hazards, queues, density, exit blocking, and telemetry.
- Room guidance computed from the live navigation graph, so recommended and backup exits follow real graph edges around walls and closed paths, exclude blocked exits, traverse configured stairs/ramps, and expose a separate wheelchair-accessible route where available.
- Original **Sentinel Link** occupant tracker with a distinctive marker per simulated occupant, current coordinates, recommended exit, and the active route that changes with simulation reroutes.
- Paired multi-seed experiment jobs with bootstrap intervals, sign-flip tests, evidence-strength labels, and CSV/JSON export.
- Separate Python-heap and process-RSS memory measurements.
- Wheelchair completion and evacuation-time telemetry for accessibility claims.

## Building input scope

- Structured EXIT-ZERO JSON is the supported fidelity-preserving building interchange. It can define floors, rooms, doors, exits, stairs, ramps, and accessibility flags.
- The legacy `/api/buildings/import-gltf` route and its wizard do **not** decode GLTF, GLB, BIM, or CAD geometry. They create an explicitly labelled navigation scaffold from declared bounds and floor count.
- Rooms, doors, exits, stairs, and ramps made by that scaffold generator are placeholders for simulation authoring. They are not geometry extracted from an uploaded building and must be manually checked before use.

## Evidence snapshot

The strongest saved result is the congested-corridor experiment with 200 occupants and 20 paired seeds (101–120):

| Measure | Baseline | EXIT-ZERO | Paired result |
| --- | ---: | ---: | ---: |
| Mean total evacuation time | 84.45 s | 72.92 s | 11.53 s lower (13.65%) |
| 95% bootstrap interval for the mean difference | — | — | 6.5 to 16.6 s |
| Paired outcomes | 3 wins | 16 wins | 1 tie |

The saved Phase 4 artifact reports `p = 0.0001`. Reproduction should be performed on the target machine before submission.

Important limits:

- The rerun 500-occupant result used only three seeds: 231.83s baseline versus 131.67s adaptive, 100.17s paired mean reduction, exact `p = 0.25`. It is preliminary, not the principal claim.
- Mixed mobility was slower on total clearance in the 20-seed result, and the Phase 5 rerun found mean wheelchair evacuation time 0.64s slower under adaptive routing. Present it as a regression and optimization target.
- Historical `<35 MB` values were Python allocation-trace results, not process RSS. New exports label Python heap and sampled RSS separately.
- Simulation findings do not establish real-world safety performance.

## Architecture

```mermaid
flowchart LR
  UI[React operations console] -->|REST /api| API[FastAPI]
  API --> SIM[Shared physical simulator]
  SIM --> BASE[Baseline routing]
  SIM --> ADAPT[EXIT-ZERO routing]
  BASE --> METRICS[Telemetry and trial metrics]
  ADAPT --> METRICS
  METRICS --> STATS[Paired statistics]
  STATS --> EXPORT[CSV / JSON evidence]
```

Both strategies use the same movement, queue, hazard-event, spawn, mobility, and seed substrate. Only route selection differs.

## Repository map

```text
backend/
  app/api/             REST endpoints
  app/experiments/     paired runner, statistics, jobs, exports
  app/models/          Pydantic state and building models
  app/simulation/      graph generation and simulation engine
  tests/               backend and fairness regression tests
frontend/
  src/components/      digital twin, controls, demo, evidence dashboard
  src/services/        API client
scenarios/             versioned scenario definitions
experiments/           saved CSV/JSON evidence artifacts
docs/                  architecture, validation, demo, deployment
submission/            hackathon-ready copy and judging notes
```

## Run locally

Prerequisites: Python 3.11+ and Node.js 20+.

Backend (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHONPATH = "..\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend, in a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies `/api` to `http://localhost:8000`.

## Verify

```powershell
$env:PYTHONPATH = "backend"
backend\.venv\Scripts\python.exe -m pytest backend\tests -q

cd frontend
npm run lint
npm run build
```

Official primary sweeps:

```powershell
$env:PYTHONPATH = "backend"
backend\.venv\Scripts\python.exe backend\run_phase4_validation_sweep.py
```

Population scaling (including the preliminary three-seed 500-person case):

```powershell
$env:PYTHONPATH = "backend"
backend\.venv\Scripts\python.exe backend\benchmark_phase4.py
```

Each scaling result is now saved as CSV and JSON instead of existing only in terminal output.

## Judge demo

Three-minute final demonstration:

1. **0:00–0:25 — Scope.** Open the multi-floor scenario and state that EXIT-ZERO is a research simulator, not a certified life-safety system.
2. **0:25–0:55 — Track one occupant.** Switch to the 2D view, click a distinctive occupant marker, and show Sentinel Link, the highlighted graph route, current location, mobility class, and recommended exit.
3. **0:55–1:25 — Change the hazard state.** Block that recommended exit in the floor plan. Show that the old exit is excluded, the route and recommended exit update, and the reroute counter/event changes.
4. **1:25–1:50 — Accessibility.** Select a wheelchair occupant and show that the simulated route uses wheelchair-accessible edges and an accessible exit rather than an ambulatory-only stair.
5. **1:50–2:10 — Room guidance.** Open **Guidance** and show primary, backup, graph distance, status, and the separately reported accessible route.
6. **2:10–2:30 — Input honesty.** Open the building reference wizard and point out that GLTF/GLB/CAD is reference metadata only; the current tool generates a bounds-based placeholder scaffold. Structured EXIT-ZERO JSON is the supported authored interchange.
7. **2:30–3:00 — Evidence and limits.** Open Evidence Lab, identify the saved 20-seed Scenario B result, then disclose the mixed-mobility regression and simplified hazard/crowd models.

The flow uses live simulation state for routing and labels saved experiment artifacts as saved evidence. A longer script is in [docs/demo_script.md](docs/demo_script.md).

## Deployment

See [docs/deployment.md](docs/deployment.md) for same-origin and split frontend/backend deployment, required environment variables, verification, and rollback guidance.

## Documentation

- [Architecture](docs/architecture.md)
- [Phase 3 predictive intelligence](docs/phase3_predictive_intelligence_report.md)
- [Phase 4 experimental validation](docs/phase4_experimental_validation.md)
- [Phase 5 evidence audit](docs/phase5_evidence_audit.md)
- [Demo script](docs/demo_script.md)
- [Deployment guide](docs/deployment.md)

