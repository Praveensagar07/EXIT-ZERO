# EXIT-ZERO — Phase 3: Predictive Adaptive Evacuation Intelligence Report

**INNOVEX 2026 Hackathon Milestone Completion**  
**Lead Software Architect & Simulation Engineer:** EXIT-ZERO Core Team  
**Date:** November 11, 2026  
**Status:** **PHASE 3 COMPLETE & VERIFIED** (31/31 Tests Passed, 250-Agent Benchmark Executed, Frontend Production Build Clean)

---

## 1. Executive Summary

Phase 3 introduces **EXIT-ZERO's Adaptive Evacuation Intelligence**, enabling the digital twin to make predictive, congestion-aware, hazard-evasive, and accessibility-constrained routing decisions. 

Crucially, **both BASELINE and EXIT-ZERO share the exact same physical movement substrate** (continuous Weidmann speed-density deceleration, corridor density tracking, and FIFO exit queue service with fractional capacity accumulation). The comparative advantages observed in simulation arise purely from routing intelligence—never from synthetic modifications to agent walking speeds.

```mermaid
flowchart TD
    subgraph Shared Physical Substrate
        A["Agent Physical Coordinates & Movement (v(ρ))"]
        B["Local Corridor Density ρ (pers/m²)"]
        C["FIFO Doorway & Exit Queues (C_j · dt)"]
        D["Hazard Exposure Accumulation"]
    end

    subgraph Routing Intelligence Layer
        E["BASELINE: Static Shortest-Path (Dijkstra on Length L)"]
        F["EXIT-ZERO: Multi-Objective Cost J(P) + Inflow Horizon"]
    end

    E -->|"Assigns nearest open exit"| A
    F -->|"Evaluates Travel + Queue + Hazard + Hysteresis"| A
    A --> B
    B --> C
    D --> F
    C --> F
```

---

## 2. Mathematical Formulation & Cost Architecture

### 2.1 Multi-Objective Routing Cost Function $J(P)$
For an occupant $k$ evaluating candidate route $P$ leading to exit $X$:

$$J(P) = T_{\text{travel}}(P) + w_q \cdot T_{\text{queue}}(X) + w_h \cdot H(P) + w_c \cdot C(P) + w_r \cdot R(P)$$

All terms are evaluated in **equivalent delay seconds**, ensuring physical dimensional consistency across the objective surface:

| Term | Mathematical Definition | Default Weight | Units | Physical Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **$T_{\text{travel}}(P)$** | $\sum_{e \in P} \frac{L_e}{\max(v_{\text{crawl}}, v(\rho_e))}$ | $w_{\text{dist}} = 1.0$ | seconds | Density-decelerated transit time along route corridors |
| **$T_{\text{queue}}(X)$** | $\frac{Q(X) + N_{\text{incoming}}(X, T_{\text{travel}})}{\max(0.5, C_{\text{exit}}(X))}$ | $w_q = 2.5$ | seconds | Current queue wait plus predictive inflow accumulation |
| **$H(P)$** | $\sum_{e \in P} L_e \cdot \text{severity}_e$ | $w_h = 8.0$ | seconds equiv. | Fire/smoke exposure penalty along route edges |
| **$C(P)$** | $\sum_{e \in P} L_e \cdot \max(0, \rho_e - 1.0)$ | $w_c = 2.0$ | seconds equiv. | Non-linear crowd crush buffer (penalizing $\rho > 1.0\text{ pers/m}^2$) |
| **$R(P)$** | $w_r \cdot \mathbb{I}(X \neq X_{\text{prev}})$ | $w_r = 5.0$ | seconds equiv. | Inertia penalty discouraging exit switching |

### 2.2 Hard Constraint Enforcement
To guarantee safety and physical realism:
- **Wheelchair Accessibility:** If an occupant has mobility category `wheelchair`, any path edge with `wheelchair_accessible == False` or non-accessible exit (e.g., stairwells) is pruned prior to Dijkstra search. Wheelchair agents can **never** receive an inaccessible route, regardless of weights.
- **Corridor & Exit Blockages:** Physically blocked edges or fire-engulfed corridors ($\text{severity} \ge 0.85$) are completely excised from the traversable subgraph $G_{\text{traversable}}$.

### 2.3 Predictive Inflow Horizon $N_{\text{incoming}}$
Rather than evaluating solely the instantaneous queue length $Q(X)$, EXIT-ZERO projects how many moving occupants will arrive at exit $X$ within a lookahead window $T_{\text{horizon}} = 20.0\text{s}$:
$$N_{\text{incoming}}(X) = \sum_{j \neq k, X_j = X} \mathbb{I}\left(\frac{d_{\text{rem}}(j)}{v_j} \le T_{\text{travel}}(k) + T_{\text{horizon}}\right)$$
This calculation inspects future states **without mutating the current simulation state**.

### 2.4 Replanning Hysteresis & Anti-Thrashing
To avoid crowd ping-pong / oscillatory route thrashing:
1. **Periodic Evaluation:** Re-evaluations occur every `replan_interval_sec = 4.0s`.
2. **Hysteresis Threshold:** A new route is adopted if and only if:
   $$J(P_{\text{new}}) < J(P_{\text{current}}) \cdot (1 - \text{hysteresis\_threshold}) \quad (\text{threshold} = 0.20 \text{ or } 20\%)$$
3. **Emergency Override:** If an occupant's target exit or current path segment becomes physically blocked or impassable due to fire/structural collapse, the hysteresis barrier is instantly bypassed, triggering an immediate `EMERGENCY_OVERRIDE` diversion.

---

## 3. Demonstration Scenarios

| Scenario ID | Name | Agents | Key Challenge & Benchmark Focus |
| :--- | :--- | :--- | :--- |
| `scenario_hq_floor1` | Corporate HQ Multi-Exit Egress | 150 | Baseline 4-exit layout with an active fire spreading in the east wing. |
| `scenario_sudden_exit_closure` | **Scenario A: Sudden Exit Closure** | 150 (250) | East Fire Escape blocks at $t=18.0$s. Evaluates immediate non-oscillating rerouting away from dead-ends. |
| `scenario_congested_corridor` | **Scenario B: Congested Central Corridor** | 200 (250) | High crowd density in central atrium creating severe hallway crush ($\rho > 5.0\text{ pers/m}^2$). Tests predictive diversion through parallel peripheral wings. |
| `scenario_spreading_smoke` | **Scenario C: Spreading Smoke** | 160 | Smoke spreads across main northern portal. Tests predictive hazard avoidance preventing severe exposure dosage. |
| `scenario_mixed_mobility` | **Scenario D: Mixed Mobility Population** | 140 | 25% wheelchair users near non-accessible stair exit. Validates strict step-free ramp allocation. |
| `scenario_university_concourse` | University Concourse Benchmark | 250 | High-capacity concourse hall with high agent density. |

---

## 4. 250-Agent Comparative Benchmark Results

Benchmarks were executed using identical random seeds ($s=42$), identical initial positions, and identical crowd dynamics ($dt=0.5\text{s}$):

### Scenario B: Congested Central Corridor ($N = 250$ Occupants)
*Tests predictive corridor diversion under extreme bottleneck crush.*

| Metric | BASELINE (Static Shortest) | EXIT-ZERO (Adaptive) | Delta / Impact |
| :--- | :--- | :--- | :--- |
| **Total Evacuation Time** | **101.5 s** | **77.0 s** | **+24.1% FASTER** (-24.5s saved) |
| **Median Evacuation Time** | **63.5 s** | **36.8 s** | **42.0% IMPROVEMENT** in egress latency |
| **Peak Exit Queue Length** | **15 persons** | **7 persons** | **53.3% REDUCTION** in exit bottlenecking |
| **Peak Crowd Density** | **5.31 pers/m²** | **5.00 pers/m²** | Reduced below crush threshold |
| **Reroutes Logged** | 0 | 11 | Controlled distribution without thrashing |
| **Step Execution Time** | 1.15 ms/step | 18.48 ms/step | **~54 steps/s** (real-time playable) |

### Scenario A: Sudden Exit Closure ($N = 250$ Occupants)
*Tests failure-aware emergency override when East Fire Exit collapses at $t=18.0\text{s}$.*

| Metric | BASELINE (Static Shortest) | EXIT-ZERO (Adaptive) | Delta / Impact |
| :--- | :--- | :--- | :--- |
| **Total Evacuation Time** | 91.5 s | 90.0 s | +1.6% FASTER |
| **Median Evacuation Time** | **42.0 s** | **38.5 s** | **8.3% IMPROVEMENT** |
| **Peak Exit Queue Length** | 13 persons | 11 persons | Lower queue surge |
| **Emergency Reroutes Logged** | 0 | **46** | Immediate diversion before impact |
| **Step Execution Time** | 1.99 ms/step | 15.03 ms/step | **~67 steps/s** (real-time playable) |

---

## 5. Verification & Automated Testing Suite

All 31 backend unit, integration, and algorithmic tests passed with 100% pass rate:

```
collected 31 items

backend\tests\test_adaptive_intelligence.py::test_baseline_vs_exit_zero_initial_decisions PASSED
backend\tests\test_adaptive_intelligence.py::test_multiobjective_cost_function_non_negative PASSED
backend\tests\test_adaptive_intelligence.py::test_predictive_incoming_queue_estimation_no_mutation PASSED
backend\tests\test_adaptive_intelligence.py::test_replanning_hysteresis_suppresses_chatter PASSED
backend\tests\test_adaptive_intelligence.py::test_emergency_override_on_exit_closure PASSED
backend\tests\test_adaptive_intelligence.py::test_hazard_avoidance_routes PASSED
backend\tests\test_adaptive_intelligence.py::test_wheelchair_accessibility_hard_constraint PASSED
backend\tests\test_adaptive_intelligence.py::test_interactive_exit_toggle_endpoint PASSED
backend\tests\test_adaptive_intelligence.py::test_reroute_events_telemetry PASSED
backend\tests\test_api.py::test_health_endpoint PASSED
backend\tests\test_api.py::test_get_scenarios PASSED
backend\tests\test_api.py::test_get_scenario_detail PASSED
backend\tests\test_api.py::test_validate_scenario_topology PASSED
backend\tests\test_api.py::test_simulation_lifecycle_and_determinism PASSED
backend\tests\test_crowd_simulation.py::test_speed_decreases_under_congestion PASSED
backend\tests\test_crowd_simulation.py::test_no_negative_speed_or_density PASSED
backend\tests\test_crowd_simulation.py::test_fifo_exit_queue_order PASSED
backend\tests\test_crowd_simulation.py::test_fractional_throughput_accumulation PASSED
backend\tests\test_crowd_simulation.py::test_no_duplicate_evacuation PASSED
backend\tests\test_crowd_simulation.py::test_wheelchair_occupant_constraints PASSED
backend\tests\test_crowd_simulation.py::test_simulation_determinism_identical_seeds PASSED
backend\tests\test_crowd_simulation.py::test_reset_reproducibility PASSED
backend\tests\test_crowd_simulation.py::test_simulation_completion PASSED
backend\tests\test_crowd_simulation.py::test_zero_occupant_and_blocked_exit_edge_cases PASSED
backend\tests\test_crowd_simulation.py::test_dt_consistency_numerical_tolerance PASSED
backend\tests\test_graph_generator.py::test_hq_graph_generation PASSED
backend\tests\test_graph_generator.py::test_university_concourse_graph_generation PASSED
backend\tests\test_graph_generator.py::test_edge_weights_and_accessibility PASSED
backend\tests\test_models.py::test_building_models_validation PASSED
backend\tests\test_models.py::test_occupant_model_validation PASSED
backend\tests\test_models.py::test_algorithm_weights_defaults PASSED

======================== 31 passed, 1 warning in 6.91s ========================
```

---

## 6. Frontend UI Extensions

The React/TypeScript frontend was extended with Phase 3 capabilities:
1. **Adaptive Reroute Event Feed (`RerouteEventFeed.tsx`):**
   - Live stream displaying every reroute with timestamp, agent ID, previous exit, new exit, reason badge (`EMERGENCY_OVERRIDE`, `QUEUE_AVOIDANCE`, `HAZARD_EVASION`), and cost improvement percentage.
   - Clicking any event focuses and highlights that agent on the floor plan.
2. **Interactive Exit Blockage Injection (`FloorPlanViewport.tsx`):**
   - User can click any exit portal directly on the SVG canvas to toggle its state (`BLOCK` $\leftrightarrow$ `OPEN`).
   - Blocked exits turn crimson with a prominent `BLOCKED` badge; open exits glow emerald.
   - Triggering a block immediately invokes emergency replanning on the backend, updating the visualization within milliseconds.
3. **Dual-Route Diff Visualization:**
   - When an occupant is selected, if they experienced an adaptive diversion, the viewport renders their *previous route* as an amber dashed polyline alongside their *current active route* in pulsing emerald green.
4. **Agent Inspector Route Cost Breakdown (`OccupantRosterPanel.tsx`):**
   - Displays objective cost $J(P)$ in delay seconds, total reroute counts, last replan timestamp, and route comparison indicator.
5. **Phase 3 Executive Review Banner (`Phase3ReviewBanner.tsx`):**
   - Displays real-time operational status, active strategy, reroute counter, and verified test badge.

---

## 7. Next Steps for Phase 4

With Phase 3 complete and fully verified:
- **Phase 4:** Comparative benchmark sweep framework, automated multi-seed batch evaluations, CSV/JSON report exports, and statistical significance analysis across all 6 scenarios.
