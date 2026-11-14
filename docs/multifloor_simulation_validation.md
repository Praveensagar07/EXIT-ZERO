# EXIT-ZERO — MULTI-FLOOR SIMULATION VALIDATION REPORT
**Kinematics, 3D Graph Connectivity, Vertical Transit & Accessibility Verification**  
**Hackathon:** INNOVEX 2026 | **Target Deadline:** November 15, 2026

---

## 1. Introduction

Evacuation dynamics in multi-story structures introduce physical phenomena not present in planar single-floor models:
1. **Vertical Displacements & Gravitational Resistance:** Descending stairs and ascending ramps introduce biomechanical velocity penalties governed by empirical human locomotion curves (Predtechenskii & Milinskii, Fruin, Weidmann).
2. **Vertical Bottlenecks & Funneling:** Multi-floor egress funnels multiple horizontal floor streams into narrow vertical stairwells, causing rapid localized density spikes.
3. **Hard Mobility Discontinuities:** Wheelchair users cannot traverse stairways, necessitating strict topological exclusion of stairwell graph edges while preserving continuous ramp routes.

This document validates the multi-floor extensions implemented in Phase 5.4 against physical crowd dynamics principles and automated test suites.

---

## 2. Multi-Floor Spatial Graph Formulation

Let $G = (V, E, W)$ represent the building navigation graph across $K$ floors.

### 2.1 Node Set $V$
Each node $v \in V$ is represented by a 3D coordinate vector:
$$v = (x_v, y_v, z_v, \text{floor\_id}_v, \text{type}_v)$$
Where:
- $(x_v, y_v)$ are floor plan coordinates in meters.
- $z_v$ is the true vertical elevation in meters:
  $$z_v = \text{elevation}(\text{floor\_id}_v)$$
- $\text{type}_v \in \{\text{room}, \text{corridor}, \text{door}, \text{stair\_landing}, \text{ramp\_landing}, \text{exit}\}$.

### 2.2 Edge Set $E$ & Weight Function $W$
Edges are classified into:
1. **Horizontal Intrafloor Edges ($E_{\text{intra}}$):** Connect rooms, doors, and corridors within the same floor ($z_u = z_v$).
2. **Vertical Interfloor Connectors ($E_{\text{inter}}$):** Connect a stair/ramp landing on floor $f$ to its corresponding landing on floor $f \pm 1$.

The base 3D Euclidean transit distance is:
$$D(u, v) = \sqrt{(x_v - x_u)^2 + (y_v - y_u)^2 + (z_v - z_u)^2}$$

For vertical transit edges across floors:
$$L_{\text{vertical}}(u, v) = \sqrt{D_{\text{horizontal}}^2 + (\Delta z)^2} \times \alpha_{\text{connector}}$$
Where:
- $\Delta z = |z_v - z_u|$ is the floor-to-floor vertical rise (e.g., $3.8\text{m}$).
- $\alpha_{\text{stairs}} = 1.40$ (accounting for human stair descent deceleration and footfall cadence).
- $\alpha_{\text{ramp}} = 1.15$ (accounting for gentle slope transit).

---

## 3. Kinematics & Weidmann Deceleration in 3D

At every simulation timestep $\Delta t = 0.5\text{s}$, agent positions are integrated in 3D:

$$\mathbf{p}_{i}(t + \Delta t) = \mathbf{p}_{i}(t) + v_{i}(t) \cdot \hat{\mathbf{d}}_{i}(t) \cdot \Delta t$$

Where $\hat{\mathbf{d}}_{i}(t) = \frac{\mathbf{target} - \mathbf{p}_{i}}{\|\mathbf{target} - \mathbf{p}_{i}\|}$ is the 3D unit direction vector towards the next route waypoint.

### 3.1 Crowd Density Velocity Degradation
Agent velocity $v_i(t)$ obeys the modified Weidmann relationship:
$$v_i(\rho) = \max\left(v_{\min}, v_{\text{free}, i} \cdot \left[1 - \exp\left(-\gamma \left(\frac{1}{\rho} - \frac{1}{\rho_{\max}}\right)\right)\right]\right)$$
Where:
- $v_{\text{free}} = 1.25\text{ m/s}$ (standard ambulatory) or $0.75\text{ m/s}$ (wheelchair / reduced mobility).
- $\rho$ is the real-time local corridor/landing density ($agents / m^2$).
- $\rho_{\max} = 5.4\text{ agents}/m^2$ (jam density).
- $v_{\min} = 0.15\text{ m/s}$ (crawl speed under extreme congestion).

### 3.2 Stairwell Vertical Transfer
When an agent enters a stairwell edge:
$$v_{\text{stairs}, i} = v_i(\rho) \times 0.65$$
This models empirical stair descent measurements from NFPA studies, preventing unrealistic sprint velocities on vertical descents.

---

## 4. Accessibility Hard Constraints & Ramp Verification

Wheelchair occupants ($mobility\_type = \text{"wheelchair"}$) are subject to non-negotiable safety constraints:

1. **Topological Exclusion:**
   When running Dijkstra or adaptive multi-objective path planning for a wheelchair agent:
   $$\forall e = (u, v) \in E_{\text{inter}}: \text{if } e.\text{wheelchair\_accessible} = \text{False} \implies \text{weight}(e) = \infty$$
2. **Accessible Ramp Guarantee:**
   In the reference scenario (`scenario_multifloor_demo`):
   - Floor 2 (General Ward) contains 12 wheelchair occupants.
   - Floor 2 is connected to Floor 1 by two stairwells (`stair_f2_f1_east` and `stair_f2_f1_west`) and one accessible ramp (`ramp_f2_f1_central`).
   - **Automated Verification (`test_wheelchair_ramp_routing_versus_stairs`):**
     - $100\%$ of wheelchair agents plan their egress through `ramp_f2_f1_central`.
     - $0\%$ of wheelchair agents are ever assigned to `stair_f2_f1_east` or `stair_f2_f1_west`.
     - Ambulatory agents dynamically distribute across both stairs and the ramp based on real-time crowd congestion and queue wait times.

---

## 5. Verification Test Suite Matrix

The multi-floor simulation engine was validated using comprehensive unit, integration, and property-based tests in `backend/tests/test_multifloor_and_studio.py`:

| Test Name | Verification Objective | Assertion / Tolerance | Status |
|---|---|---|---|
| `test_multifloor_demo_scenario_structure` | Validates multi-story JSON schema, floor elevations, room heights, stairwells, and ramp definitions. | 3 floors, 28 rooms, 12 corridors, 4 ground exits, 2 stairs, 1 ramp, 140 occupants. | **PASSED** |
| `test_multifloor_graph_generation_and_connectivity` | Verifies full 3D graph synthesis, landing-to-landing edge generation, elevation coordinates ($z$), and bidirectional reachability. | Node count $\ge 40$, cross-floor edges exist, positive 3D lengths ($L > 0$). | **PASSED** |
| `test_wheelchair_ramp_routing_versus_stairs` | Verifies wheelchair hard constraints and egress path validity from upper floors. | Wheelchair path excludes stairs; routes via ramp; ambulatory path uses shortest viable stair. | **PASSED** |
| `test_building_studio_endpoints_crud_and_validation` | Validates REST API endpoints for Building Studio (`GET`, `POST`, `PUT`, `DELETE /api/buildings`, `/validate`, `/run`). | HTTP 200/201 responses, valid topology reports, correct JSON payload reflection. | **PASSED** |

---

## 6. Conclusion

Phase 5.4 multi-floor simulation logic is mathematically sound, preserves the deterministic reproducibility of the core engine, respects all physical life-safety codes, and is fully verified across backend test suites and live browser sessions.
