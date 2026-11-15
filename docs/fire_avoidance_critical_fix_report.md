# EXIT-ZERO — CRITICAL FIX: PHYSICS-BASED FIRE AVOIDANCE REPORT
**Hackathon:** INNOVEX 2026 | **Date:** November 15, 2026  
**System:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Repository:** `https://github.com/Praveensagar07/EXIT-ZERO.git`  
**Branch:** `fix/physics_based_fire_avoidance` $\rightarrow$ Merged to `master`  
**Priority:** P0 — Critical Simulation Correctness  
**Verdict:** **VERIFIED & PASSED (71/71 Tests Pass, 99.93% Exposure Reduction) — STATUS: GO**

---

## 1. ROOT CAUSE ANALYSIS & DETERMINISTIC REPRODUCTION

### Defect Observed in Screenshot:
Occupants on Floor 3 (e.g. `occ_136`, `occ_115`, `occ_102`) were observed walking eastward along the corridor directly toward an active fire located in Room R-305 (Telecom & Server Rack, coordinates $x=68.0, y=8.0$), passing directly in front of doorway D-305.

### Deterministic Trace of Three Affected Occupants (Seed 42, Scenario `scenario_multifloor_demo`):
Prior to this fix, tracing `occ_136`, `occ_115`, and `occ_102` revealed:

| Time | Agent ID | Floor | Position $(x, y, z)$ | Distance to Fire | Edge Hazard | Next Waypoint | Action / Status |
|---|---|---|---|---|---|---|---|
| **$t=8.0$s** | `occ_136` | Floor 3 | $(65.39, 10.50, 6.40)$ | $3.61\text{m}$ | $0.000$ | `node_corr_north_floor_3_9` $(68.0, 10.5)$ | Moving East toward fire |
| **$t=10.0$s** | `occ_136` | Floor 3 | $(68.00, 10.50, 6.40)$ | **$2.50\text{m}$** | $0.000$ | `node_corr_spine_floor_3_15` $(68.0, 22.5)$ | Passing in front of fire door D-305 |
| **$t=11.0$s** | `occ_115` | Floor 3 | $(67.90, 10.50, 6.40)$ | **$2.50\text{m}$** | $0.000$ | `node_corr_north_floor_3_9` $(68.0, 10.5)$ | Walking directly toward fire |
| **$t=15.0$s** | `occ_102` | Floor 3 | $(68.00, 11.21, 6.40)$ | **$3.21\text{m}$** | $0.000$ | `node_corr_spine_floor_3_15` $(68.0, 22.5)$ | Trailing through thermal zone |

All three occupants had `Reroute Events: 0`, `Target Exit: exit_east_fire`, and `Local Hazard Intensity: 0.000`.

### Specific Root Causes Diagnosed:
1. **Dijkstra Pure-Distance Weighting (`weight="weight"`):** Dijkstra shortest-path calculations in `_route_occupant()` used static geometric edge lengths. It evaluated only one single shortest path per candidate exit. Detours around hazardous corridors were never discovered or scored.
2. **Post-Hoc Objective Scoring Flaw:** The multi-objective cost function $J(P)$ was evaluated only *after* Dijkstra had already locked into the shortest geometric path. Even when a hazard was present, distance outweighed hazard cost because safer alternative corridor paths were never generated.
3. **Midpoint-Only Hazard Sampling:** `_update_hazards_and_corridors()` evaluated hazard intensity only at the edge midpoint:
   $$\text{mid} = \frac{P_u + P_v}{2}$$
   Long corridor edges had endpoints $1\text{m}$ from the fire, but their midpoints were $8\text{m}$ away, resulting in reported hazard level $0.000$.
4. **Floor-Agnostic Hazard Evaluation:** The simulation engine computed 2D Euclidean distances without filtering by `floor_id`, causing floor leakage and failing to model compartmentation.
5. **Absence of Compartmentation & Differential Smoke Spread:** Fires inside closed rooms were treated as Euclidean circles radiating through solid concrete walls. Smoke spread was not modeled along connected corridors, and burning rooms were not closed off to through-traffic.
6. **High Impassability Threshold & Missing Immediate Replan:** Impassability was gated at $\ge 0.85$, and replanning was delayed until periodic intervals ($4\text{s}$), failing to trigger immediate emergency avoidance when corridors became hazardous.

---

## 2. EXACT CODE CHANGES

### Backend Changes:
1. `backend/app/models/building.py`:
   - Enhanced `HazardSource` schema with `current_radius`, `smoke_radius`, `affected_room_id`, and `is_active`.
2. `backend/app/models/graph.py`:
   - Added `smoke_level: float = 0.0` and `is_impassable: bool = False` to `GraphEdge`.
3. `backend/app/models/scenario.py`:
   - Added `w_fire: float = 50.0`, `w_smoke: float = 25.0`, `fire_impassable_threshold: float = 0.60`, and `smoke_impassable_threshold: float = 0.80` to `AlgorithmWeights`.
4. `backend/app/models/simulation_state.py`:
   - Updated `RouteCostBreakdown` with explicit `fire_exposure_cost` and `smoke_exposure_cost`.
5. `backend/app/simulation/engine.py`:
   - **Physics-Based Compartment & Smoke Propagation:** Implemented deterministic thermal fire growth in the origin compartment, doorway venting, differential smoke expansion along connected corridor edges ($v_{\text{smoke}} \approx 0.8\text{ m/s}$), and solid wall boundary enforcement.
   - **5-Point Equidistant Edge Sampling:** Implemented numerical sampling along each edge segment $P(t) = P_u + t(P_v - P_u)$ for $t \in \{0.0, 0.25, 0.50, 0.75, 1.0\}$, calculating peak and mean fire/smoke exposure.
   - **Dynamic Edge Cost $J(e)$ in Dijkstra:** Configured NetworkX edge weights directly with multi-objective traversal cost:
     $$J(e) = T_{\text{travel}}(e) + w_c \times T_{\text{congestion}}(e) + w_f \times E_{\text{fire}}(e) + w_s \times E_{\text{smoke}}(e)$$
     Impassable edges ($E_{\text{fire}} \ge 0.60$, $E_{\text{smoke}} \ge 0.80$, or entering burning rooms) are strictly pruned.
   - **Immediate Emergency Replanning:** Evaluates occupant paths every step; if any upcoming edge is impassable or dangerous ($\ge 0.20$), triggers immediate replanning, bypassing hysteresis.
   - **Honest Trapped State:** If no safe path to an exit exists, occupants enter `EvacuationState.TRAPPED` with zero speed and empty path.
6. `backend/tests/test_physics_fire_avoidance.py`:
   - Added 10 regression tests (Tests A through J) verifying all requirements.

### Frontend Changes:
1. `frontend/src/types/simulation.ts`:
   - Aligned `HazardSource` and `GraphEdge` interfaces with backend schemas.
2. `frontend/src/components/BuildingViewport3D.tsx`:
   - Updated 3D hazard visualization to synchronize directly with backend `current_radius` and `smoke_radius`.
   - Added dynamic 3D red warning barrier ribbons rendering along impassable and hazardous corridor edges.

---

## 3. HAZARD MODEL & ASSUMPTIONS

| Phenomenon | Mathematical Formulation | Physical Assumption |
|---|---|---|
| **Thermal Fire Growth** | $R_{\text{fire}}(t) = \min(R_{\max}, \Delta t \times \text{growth\_rate})$ | Confined to origin compartment until doorway flashover; extends $\le 2.5\text{m}$ through open doors. |
| **Smoke Propagation** | $R_{\text{smoke}}(t) = \min(1.8 R_{\max}, \Delta t \times 4.0 \times \text{growth\_rate})$ | Expands $\approx 4\times$ faster than flame ($v_{\text{smoke}} \approx 0.8\text{m/s}$), channeling through open doorways along connected corridors. |
| **Wall & Boundary Barrier** | $I(P) = 0$ if line-of-sight intersects a structural wall without doorway | Solid walls completely prevent flame and toxic aerosol transmission. |
| **Multi-Floor Isolation** | Hazard evaluated strictly on $h.\text{floor\_id}$ | Flame and smoke remain on active floor slab unless venting through stair shafts. |
| **Edge Impassability** | $\hat{E}_{\text{fire}} \ge 0.60 \lor \hat{E}_{\text{smoke}} \ge 0.80$ | Exceeds human physiological tenability limits (radiant heat / toxic optical density). Edge removed from graph. |
| **Deceleration Dosage** | $v_{\text{eff}} = v_{\text{weidmann}}(\rho) \times \max(0.35, 1.0 - 0.15 \times \text{exposure})$ | Smoke inhalation reduces movement velocity up to 65% based on accumulated dosage. |

---

## 4. ROUTING CORRECTION & TRACE VERIFICATION

After implementing hazard-aware dynamic edge cost $J(e)$ and emergency replanning, the identical scenario (Seed 42) was re-simulated:

| Time | Agent ID | Floor | Position $(x, y, z)$ | Distance to Fire | Edge Hazard | Next Waypoint | Action / Status |
|---|---|---|---|---|---|---|---|
| **$t=8.0$s** | `occ_136` | Floor 3 | $(63.95, 10.50, 6.40)$ | $4.76\text{m}$ | $0.000$ | `node_corr_north_floor_3_8` $(61.8, 10.5)$ | **Turned around! Moving West** |
| **$t=9.0$s** | `occ_136` | Floor 3 | $(62.50, 10.50, 6.40)$ | $6.04\text{m}$ | $0.000$ | `node_corr_north_floor_3_8` $(61.8, 10.5)$ | Evacuating away from fire |
| **$t=10.0$s** | `occ_136` | Floor 3 | $(61.05, 10.50, 6.40)$ | $7.39\text{m}$ | $0.000$ | `node_corr_north_floor_3_7` $(55.6, 10.5)$ | Increasing distance to fire |
| **$t=12.0$s** | `occ_136` | Floor 3 | $(58.14, 10.50, 6.40)$ | $10.17\text{m}$ | $0.000$ | `node_corr_north_floor_3_7` $(55.6, 10.5)$ | Safely navigating to central ramp |
| **$t=15.0$s** | `occ_136` | Floor 3 | $(54.12, 10.50, 6.40)$ | **$14.10\text{m}$** | $0.000$ | `node_corr_north_floor_3_6` $(49.3, 10.5)$ | Preparing vertical egress |

Occupants `occ_115` and `occ_102` exhibited identical safe evasion, increasing distance to $14.69\text{m}$ and $19.52\text{m}$ respectively. Cumulative exposure remained **$0.0000$**.

---

## 5. REGRESSION TEST RESULTS (TESTS A THROUGH J)

Executed via `$env:PYTHONPATH="backend"; backend\.venv\Scripts\python.exe -m pytest backend\tests`:

| Test ID | Test Objective | Assertion Verified | Result |
|---|---|---|:---:|
| **Test A** | Occupant near fire with safe alternative exit | Distance to fire increases; impassable/burning nodes strictly avoided. | **PASS** |
| **Test B** | Fire appears directly on current route | Immediate emergency replanning triggered without waiting for periodic timer. | **PASS** |
| **Test C** | Fire blocks nearest exit | Active agents targeting blocked exit divert immediately to alternative open exits. | **PASS** |
| **Test D** | Fire blocks every exit | Agents correctly transition to `EvacuationState.TRAPPED` with zero speed; no teleportation. | **PASS** |
| **Test E** | Smoke spreads through corridor | Smoke edges receive higher dynamic traversal costs and divert occupant flows. | **PASS** |
| **Test F** | Multi-floor stair routing near fire | Occupants on Floor 3 avoid compromised east stairs and use safe central ramp/west stairs. | **PASS** |
| **Test G** | Wheelchair occupant near fire | Wheelchair users strictly restricted to accessible ramps, avoiding stairs and fire. | **PASS** |
| **Test H** | Crowded safe exit vs less-crowded hazardous exit | Hard hazard constraints strictly enforced; safe exit chosen despite queue delay. | **PASS** |
| **Test I** | Baseline vs Adaptive comparison | Both strategies respect impassability and emergency safety; burning rooms avoided. | **PASS** |
| **Test J** | Deterministic replay | Identical inputs and seeds yield 100% bit-for-bit identical occupant coordinates and metrics. | **PASS** |

**Full Backend Test Suite: 71 passed, 0 failed in 28.32s (100% pass rate).**

---

## 6. COMPARATIVE EXPOSURE & EVACUATION METRICS

Paired experiment conducted on `scenario_multifloor_demo` (Seed 42, 140 occupants, 180s simulation limit):

| Metric | Baseline Strategy | Adaptive (EXIT-ZERO) Strategy | Improvement / Impact |
|---|---|---|---|
| **Total Evacuated** | 127 / 140 (90.7%) | **140 / 140 (100.0%)** | **+9.3% completion** |
| **Total Trapped** | 0 | 0 | 0 trapped |
| **Total Evacuation Time** | Incomplete ($> 180\text{s}$) | **161.5s** | Successful egress |
| **Cumulative Hazard Exposure** | 133.160 dosage | **0.090 dosage** | **-99.93% exposure reduction** |
| **Impassable Edge Violations** | 0 | 0 | Zero violations |
| **Total Reroute Events** | 0 | 34 | Adaptive avoidance |
| **Peak Exit Queue Length** | 7 occupants | 6 occupants | Reduced congestion |
| **Wheelchair Completion** | 24 / 24 (100.0%) | 24 / 24 (100.0%) | 100% accessible safety |
| **Wheelchair Mean Time** | 111.29s | 113.88s | Stable equitable egress |

---

## 7. BROWSER VERIFICATION & EVIDENCE

The live frontend (`http://localhost:5173`) was verified using automated Playwright tests (`tests_e2e/test_fire_avoidance_verification.cjs`):
- **BEFORE Hazard Screenshot:** `docs/evidence_screenshots/fire_avoidance_before.png` (247 kB)  
  Captured at $t=0.0\text{s}$: All building corridors clear, occupants staged across floors.
- **AFTER Hazard Screenshot:** `docs/evidence_screenshots/fire_avoidance_after.png` (247 kB)  
  Captured during active fire: Volumetric smoke and flame rendered in Room R-305, red impassable warning ribbons visible on the east corridor, and Floor 3 occupants actively moving westward away from the hazard toward the central ramp.

---

## 8. REMAINING LIMITATIONS

1. **CFD vs Empirical Network Model:** The model uses deterministic graph-based network propagation ($v_{\text{smoke}} = 0.8\text{m/s}$) rather than full Navier-Stokes CFD calculations.
2. **Door Aerodynamics:** Doorways are treated as binary orifices (open or closed) without modeling thermal stack pressure gradients.
3. **Smoke Stratification Height:** Occupant breathing zone exposure assumes a well-mixed vertical layer per floor rather than continuous 3D vertical stratification.

---

## 9. GO / NO-GO VERDICT

- **Simulation Physics:** All agents obey Weidmann speed constraints, door capacities, multi-floor geometry, and zero-impassability rules.
- **Fire Avoidance:** Occupants dynamically turn away and evacuate via safe alternative paths.
- **Test Integrity:** 71 / 71 backend tests passing (including 10 new regression tests).
- **Frontend Quality:** TypeScript production build succeeds with 0 errors (849ms).
- **Verdict:** **DEPLOYMENT GO**.
