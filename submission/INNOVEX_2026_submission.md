# EXIT-ZERO — INNOVEX 2026 Submission Copy

## Project title

EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin

## One-line summary

An interactive research simulator that compares conventional shortest-path evacuation with predictive, congestion-aware, hazard-aware, and accessibility-constrained routing under reproducible paired conditions.

## Problem

Static evacuation guidance can direct too many people toward the same apparently short route, while conditions, queues, and exit availability change. Evaluating alternative routing safely in real buildings is difficult, expensive, and ethically constrained.

## Solution

EXIT-ZERO creates a deterministic digital twin of a building, occupants, hazards, corridors, and capacity-limited exits. It runs a conventional safety-aware shortest-path baseline and an adaptive multi-objective strategy on the same physical substrate. Users can observe the simulation, inject an exit blockage, inspect reroutes, run paired multi-seed experiments, and export evidence.

Room guidance is derived from the live navigable graph rather than straight-line proximity. Recommendations therefore follow configured door/corridor edges, walls and blockages, use vertical connectors between floors, exclude blocked exits, and separately report wheelchair-accessible egress when reachable.

## What makes it different

- Predictive inflow estimates anticipate queue growth before occupants arrive.
- Accessibility is a hard routing constraint, not a cosmetic dashboard label.
- Replanning hysteresis reduces route switching and crowd oscillation.
- Baseline and adaptive strategies share identical movement and queuing physics.
- Evidence is reported with paired seeds, confidence intervals, sign-flip tests, and explicit negative results.
- The original Sentinel Link interface gives each simulated occupant a distinctive marker and shows current location, safest active simulated route, recommended exit, and hazard-triggered reroutes.

## Evidence

The principal saved benchmark is Scenario B with 200 occupants and 20 paired seeds. The saved artifact reports:

- Baseline mean total evacuation time: 84.45 s.
- EXIT-ZERO mean total evacuation time: 72.92 s.
- Paired mean difference: 11.53 s, or 13.65% lower.
- 95% bootstrap interval: 6.5 to 16.6 s.
- Outcomes: 16 adaptive wins, 3 baseline wins, and 1 tie.

This is simulation evidence under the implemented assumptions. It is not a claim of real-world injury reduction or certified evacuation performance.

## Honest limitations

- The hazard model is simplified and is not computational fire dynamics.
- The crowd model is not calibrated as a clinical crush or injury model.
- The preliminary 500-occupant result uses three seeds and is not the principal claim.
- The mixed-mobility sweep was 2.28% slower in total clearance for adaptive routing, and the Phase 5 rerun measured mean wheelchair evacuation time 0.64s slower. This is reported as an open regression.
- Experiment jobs are in-process and are not yet a distributed workload system.
- GLTF/GLB/CAD mesh decoding and semantic room/stair extraction are not implemented. The legacy import-labelled endpoint creates a bounds-based navigation scaffold whose rooms, doors, exits, stairs, and ramps are generated placeholders. Structured EXIT-ZERO JSON is the supported authored building format.
- Routes and accessibility results are only as reliable as the authored graph, dimensions, hazards, and accessibility tags supplied to the simulator.

## Technology

React, TypeScript, Vite, Recharts, FastAPI, Pydantic, NumPy, NetworkX, pytest, and psutil.

## Demonstration

Three-minute judge sequence:

- **0:00–0:25:** State the research-prototype boundary and load the multi-floor scenario.
- **0:25–0:55:** In 2D, select a distinctive occupant marker; show Sentinel Link, current location, highlighted route, mobility class, and recommended exit.
- **0:55–1:25:** Block the recommended exit and show the live route, exit recommendation, and reroute event update.
- **1:25–1:50:** Select a wheelchair occupant and show the accessibility-constrained route to an accessible exit.
- **1:50–2:10:** Open room guidance and show graph-derived primary/backup assignments and accessible-route status.
- **2:10–2:30:** Open the building wizard and explicitly show that it generates a placeholder scaffold from bounds; it does not extract geometry from GLTF/GLB/CAD.
- **2:30–3:00:** Open Evidence Lab for the saved 20-seed Scenario B result, then disclose the mixed-mobility regression and model limitations.

For reproducibility, run `python -m pytest tests -q` from `backend`, and run `npm run lint` plus `npm run build` from `frontend`. Re-run the official sweep with `backend/run_phase4_validation_sweep.py` before presenting performance numbers from a new machine.

## Links

- Source repository: https://github.com/Praveensagar07/EXIT-ZERO
- Live demo: not deployed or provided in the current project files.
- Demo video: not provided in the current project files.

Add only verified public links before submission.

