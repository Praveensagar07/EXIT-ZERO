# EXIT-ZERO — INNOVEX 2026 Submission Copy

## Project title

EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin

## One-line summary

An interactive research simulator that compares conventional shortest-path evacuation with predictive, congestion-aware, hazard-aware, and accessibility-constrained routing under reproducible paired conditions.

## Problem

Static evacuation guidance can direct too many people toward the same apparently short route, while conditions, queues, and exit availability change. Evaluating alternative routing safely in real buildings is difficult, expensive, and ethically constrained.

## Solution

EXIT-ZERO creates a deterministic digital twin of a building, occupants, hazards, corridors, and capacity-limited exits. It runs a conventional safety-aware shortest-path baseline and an adaptive multi-objective strategy on the same physical substrate. Users can observe the simulation, inject an exit blockage, inspect reroutes, run paired multi-seed experiments, and export evidence.

## What makes it different

- Predictive inflow estimates anticipate queue growth before occupants arrive.
- Accessibility is a hard routing constraint, not a cosmetic dashboard label.
- Replanning hysteresis reduces route switching and crowd oscillation.
- Baseline and adaptive strategies share identical movement and queuing physics.
- Evidence is reported with paired seeds, confidence intervals, sign-flip tests, and explicit negative results.

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

## Technology

React, TypeScript, Vite, Recharts, FastAPI, Pydantic, NumPy, NetworkX, pytest, and psutil.

## Demonstration

The demonstration runs baseline and adaptive routing with the same Scenario B seed, then opens the Evidence Lab to show the 20-seed result, per-seed outcomes, uncertainty labels, memory methodology, and downloadable CSV/JSON artifacts.

## Links

- Source repository: not provided in the current project files.
- Live demo: not deployed or provided in the current project files.
- Demo video: not provided in the current project files.

Add only verified public links before submission.

