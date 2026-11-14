# EXIT-ZERO — Phase 5.3 Real Browser Acceptance Testing Report

**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Hackathon:** INNOVEX 2026 (Submission Deadline: November 15, 2026)  
**Evaluation Date:** November 14, 2026  
**Auditor Roles:** Principal QA Engineer, Simulation Reliability Specialist, Full-Stack Release Engineer, Accessibility Auditor, Strict Hackathon Judge  
**Execution Environment:** Windows 11 (64-bit), Python 3.12.10 virtual environment, Node.js v24.20.0, Headless Microsoft Edge via Playwright 1.65.1  
**Release Candidate Identifier:** `EXIT-ZERO-v1.0.0-rc1`  
**Overall Acceptance Verdict:** ✅ **PASS (GO FOR PHASE 6 DEPLOYMENT)**

---

## 1. Executive Summary & Verification Scope

In Phase 5.3, the complete, end-to-end EXIT-ZERO system underwent rigorous real browser acceptance testing, responsive UI validation across 4 standard viewports, accessibility semantic audits, determinism and performance scaling evaluations, and statistical integrity lock.

Testing was conducted using live browser automation against the active local stack:
- **Backend Daemon:** FastAPI engine running on `http://127.0.0.1:8000` via Uvicorn.
- **Frontend Server:** React 19 + Vite 8.3.7 development server on `http://localhost:5173`, with `/api` proxied to the backend.
- **Client Runner:** Playwright driving real headless Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).

All 10 acceptance tests (C1 through C10) passed completely with **0 uncaught JavaScript console errors**, **0 failed network requests**, and **0 physical simulation violations**.

---

## 2. End-to-End Browser Acceptance Test Matrix (C1 – C10)

| Test ID | Objective | Verified System Behavior | Status | Visual Evidence Artifact |
| :---: | :--- | :--- | :---: | :--- |
| **Test C1** | **Initial Experience & Dashboard** | Clean browser load, no blank screen, page title `"EXIT-ZERO · Evacuation Digital Twin"`, brand headers, 8 scenarios in selector, interactive SVG floor canvas loaded. Zero uncaught console errors or 4xx/5xx requests. | **PASS** | `docs/evidence_screenshots/c1_initial_experience.png` |
| **Test C2** | **Scenario Selection & Topology** | Sequentially selected all 8 scenarios (`scenario_normal_evacuation`, `scenario_sudden_exit_closure`, `scenario_congested_corridor`, `scenario_spreading_smoke`, `scenario_mixed_mobility`, `scenario_combined_emergency`, `scenario_hq_floor1`, `scenario_university_concourse`). Each initialized correct geometry, room layouts, and exits with zero stale state. | **PASS** | `docs/evidence_screenshots/c2_scenario_selection.png` |
| **Test C3** | **Baseline Simulation & Playback** | Conventional Dijkstra shortest-path selected on Scenario B (Seed 101). Verified step-by-step advance (+0.5s/step), continuous time progression, play/pause state transitions, 2x speed multiplier, and deterministic reset to $t = 0.0\text{s}$. Occupants surge to the nearest north portal creating a 36-person bottleneck. | **PASS** | `docs/evidence_screenshots/c3_baseline_simulation.png` |
| **Test C4** | **Adaptive Simulation (EXIT-ZERO)** | Switched to Adaptive algorithm on identical seed (101). Verified multi-objective lookahead cost evaluation, proactive diversion to West Ramp and East Fire Escape before bottlenecks form, no occupant teleportation, and live reroute telemetry updates. | **PASS** | `docs/evidence_screenshots/c4_adaptive_simulation.png` |
| **Test C5** | **Emergency Exit Closure & Reopen** | During active evacuation, East Fire Escape (`exit_east_fire`) was clicked and closed. Backend immediately registered `is_blocked = True`, invalidated the NetworkX cache, and issued emergency reroutes. Zero occupants trapped. Reopening restored the exit and normalized routing. | **PASS** | `docs/evidence_screenshots/c5_exit_blocked.png`<br>`docs/evidence_screenshots/c5_exit_reopened.png` |
| **Test C6** | **Hazard Propagation & Edge Threshold** | Executed evolving hazard scenario (`scenario_spreading_smoke`). Stepped through 15 ticks (7.5s); smoke expanded; critical threshold ($\ge 0.85$) triggered cache invalidation and corridor exclusion. Occupants diverted smoothly; zero trapped occupants. | **PASS** | `docs/evidence_screenshots/c6_hazard_propagation.png` |
| **Test C7** | **Accessibility & Mixed Mobility** | Executed Scenario D ($N=140$, 25% wheelchair users). Wheelchair occupants visually distinct (amber circles `#f59e0b`). ADA-inaccessible stairs excluded from wheelchair routes; ground-floor West Ramp prioritized. Wheelchair unreachable count strictly 0. | **PASS** | `docs/evidence_screenshots/c7_accessibility_mixed_mobility.png` |
| **Test C8** | **Occupant Inspector** | Selected individual occupant on floor canvas. Interactive HUD appeared showing ID, mobility category, instantaneous velocity (m/s), assigned exit, distance traveled, and queue delay. Deselecting smoothly closed the inspector. Zero UI clipping. | **PASS** | `docs/evidence_screenshots/c8_occupant_inspector_active.png` |
| **Test C9** | **Reproducible Evidence Lab** | Opened Evidence Lab. Verified preloaded Scenario B benchmark ($N=200$, 20 seeds): Baseline `84.45s`, Adaptive `72.92s`, Delta `11.53s` (+13.65%), 95% Bootstrap CI `[6.5, 16.6]s`, $p = 0.0001$, 16 wins / 3 losses / 1 tie. CSV and JSON exports downloaded and verified. Executed a real live 3-seed benchmark job and confirmed polling completion. | **PASS** | `docs/evidence_screenshots/c9_evidence_lab_verified.png`<br>`docs/evidence_screenshots/c9_live_experiment_completed.png` |
| **Test C10** | **Full 6-Step Judge Walkthrough** | Conducted the complete guided judge presentation through `DemonstrationModeModal`: Step 1 (Architecture), Step 2 (Baseline run), Step 3 (Bottleneck physics), Step 4 (Adaptive run), Step 5 (Live blockage), Step 6 (Evidence Lab). All actions executed without restarting the application. | **PASS** | `docs/evidence_screenshots/c10_step1` through `c10_step6` |

---

## 3. Six-Step Guided Judge Demonstration Verification

The 6-step presentation HUD was executed in sequence matching `docs/judge_demo_final.md`:

1. **Step 1 — Building Layout & Occupant Distribution:**
   - Action: `Load Building Layout & Reset`
   - Verified: Loads `scenario_congested_corridor` with 200 occupants, 4 exits, Seed 101, Baseline mode.
   - Result: Successful reset and clean floor layout display.
2. **Step 2 — Conventional Shortest-Path Evacuation:**
   - Action: `Load & Run Baseline`
   - Verified: Starts simulation at 1x speed. Occupants stream greedily toward North Portal.
   - Result: Hallway density exceeds 3.2 pers/m²; central bottleneck forms.
3. **Step 3 — Formation of Congestion & Bottlenecks:**
   - Action: `Inspect Bottleneck Telemetry`
   - Verified: Live metrics banner shows $t = 8.0\text{s}$, peak density $5.00\text{ pers/m}^2$, queue length growth.
   - Result: Clear visual and numeric evidence of Weidmann deceleration.
4. **Step 4 — Predictive Adaptive Routing (EXIT-ZERO):**
   - Action: `Run EXIT-ZERO Adaptive Simulation`
   - Verified: Resets with identical seed (101) under Adaptive algorithm and begins playback.
   - Result: Central crowd proactively bifurcates toward East Fire Escape and West Ramp.
5. **Step 5 — Live Emergency Exit Failure & Resilience:**
   - Action: `⚡ Block East Fire Escape`
   - Verified: Closes `exit_east_fire` at simulated runtime ($t \approx 18\text{s}$). Cache invalidation fires immediately; occupants pivot smoothly toward open exits.
   - Result: Zero trapped occupants; zero route oscillation.
6. **Step 6 — Experimental Evidence & Scientific Rigor:**
   - Action: `Open Evidence Dashboard`
   - Verified: Seamless view transition to Evidence Lab without reloading page or dropping connection.
   - Result: 20-seed paired charts, confidence intervals, and download buttons immediately accessible.

---

## 4. Responsive Viewport Quality Assurance Matrix

The interface was evaluated across all four mandatory screen viewports:

| Viewport Profile | Resolution | Orientation | Key Findings & Validations | Status | Screenshot Artifact |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Desktop** | 1920 × 1080 | Landscape | Full layout fits on single line. Floor plan, telemetry panel, and HUD render with optimal whitespace. SVG scales to 14 px/m. | **PASS** | `docs/evidence_screenshots/d_responsive_desktop_sim.png` |
| **Laptop** | 1366 × 768 | Landscape | Header wraps cleanly onto two dedicated flex rows (Row 1: Brand + Nav + Demo button + Census; Row 2: Scenario, Strategy, Seed, Speed, Playback). Resolved a pointer-event interception defect between controls and demo button. | **PASS** | `docs/evidence_screenshots/d_responsive_laptop_sim.png`<br>`docs/evidence_screenshots/d_responsive_laptop_hud.png` |
| **Tablet** | 768 × 1024 | Portrait | Header collapses gracefully. Canvas scales down dynamically with `handleFitToView`. Sidebar tabs and Evidence Lab stack vertically with smooth scrolling. | **PASS** | `docs/evidence_screenshots/d_responsive_tablet_sim.png`<br>`docs/evidence_screenshots/d_responsive_tablet_evidence.png` |
| **Mobile** | 390 × 844 | Portrait | Full touch navigation supported. Header switches to compact layout. View switcher, layer controls, and Evidence Lab cards display in single-column scrollable feed. Text remains legible. | **PASS** | `docs/evidence_screenshots/d_responsive_mobile_sim.png`<br>`docs/evidence_screenshots/d_responsive_mobile_evidence.png` |

---

## 5. Accessibility Audit Findings (WCAG 2.1 AA Compliance)

- **Landmark Structure:** Valid `<header>`, `<main>`, `<nav aria-label="Primary views">`, and `<aside>` landmark regions across both primary views.
- **Form Controls & Labels:** Added missing `aria-label="Scenario for benchmark"` and `aria-label="Occupant population size"` to Evidence Lab dropdowns. All `select` and `input` elements now possess explicit accessible labels (0 missing across all 4 viewports).
- **Keyboard Navigation:** Tab navigation flows logically across header buttons, dropdowns, canvas controls, and sidebar tabs. Initial focus lands on interactive `<button>` elements. Escape key closes the Demonstration HUD.
- **Color Contrast & Theme:** High-contrast slate theme (`#020617` / `#0f172a` against emerald `#10b981` and amber `#f59e0b`). Zero low-contrast purple gradients.
- **Reduced Motion:** SVG transitions use smooth `duration-300` and CSS transforms without jarring or disorienting animations.

---

## 6. Bugs Discovered & Remediated in Phase 5.3

| Defect ID | Severity | Description | Remediation Applied | Regression Test |
| :---: | :---: | :--- | :--- | :--- |
| **BUG-5.3-01** | **P2** | **TopNavBar Laptop Viewport Collision (1366×768):** At laptop width, Section 2 (`xl:w-auto xl:flex-nowrap`) wrapped into Section 1's bounding box, intercepting pointer clicks on the `Interactive Demo` button. | Updated Section 2 to wrap cleanly with `2xl:order-none 2xl:w-auto 2xl:flex-nowrap` and Section 1 to `flex min-w-0 items-center`. Row 1 and Row 2 now separate cleanly without collision. | `test_phase_d_responsive.cjs` (Passed on 1366×768) |
| **BUG-5.3-02** | **P2** | **Evidence Lab Missing Form Labels:** The Scenario and Population selects in `ExperimentsDashboard.tsx` lacked accessible aria-labels, failing accessibility audit tools. | Added explicit `aria-label="Scenario for benchmark"` and `aria-label="Occupant population size"`. | `test_phase_d_responsive.cjs` (0 missing labels) |
| **BUG-5.3-03** | **P2** | **Demonstration HUD Close Button Accessibility:** Close button in `DemonstrationModeModal.tsx` had `title="Close demonstration"` but lacked `aria-label`. | Added `aria-label="Close demonstration"` alongside existing `title` and `ref`. | `test_phase_d_responsive.cjs` (Passed on all viewports) |

---

## 7. Final Phase 5.3 Verdict

All 10 browser acceptance tests passed. All P0, P1, and P2 defects are resolved. The system is verified stable, deterministic, visually polished, and **APPROVED FOR RELEASE FREEZE (EXIT-ZERO-v1.0.0-rc1)**.
