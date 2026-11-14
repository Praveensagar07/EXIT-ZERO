# EXIT-ZERO: System Architecture & Mathematical Foundations

## 1. Overview
EXIT-ZERO models emergency egress as a dynamic, flow-constrained spatial graph problem coupled with a discrete-event agent-based occupant simulation.

```
+-------------------------------------------------------------+
|                 EXIT-ZERO Architecture                      |
+-------------------------------------------------------------+
|                                                             |
|  [ Scenario & Geometry ]                                    |
|      |                                                      |
|      v                                                      |
|  [ Procedural / JSON Floor Plan ]                           |
|      |                                                      |
|      v                                                      |
|  [ NetworkX Navigation Graph G = (V, E) ]                   |
|      * Nodes: Rooms, Doors, Corridor Junctions, Exits        |
|      * Edges: Euclidean distance d(u, v), Capacity C_e,     |
|               Accessibility flag A_e                        |
|      |                                                      |
|      +------------------------+                             |
|      |                        |                             |
|      v                        v                             |
|  [ Baseline Router ]    [ EXIT-ZERO Adaptive Router ]       |
|   Static Dijkstra        Multi-objective Cost Function:     |
|   min sum(d(u,v))        J(p) = w_d * Dist + w_c * Congest  |
|                               + w_q * Queue + w_h * Hazard  |
|      |                        |                             |
|      +-----------+------------+                             |
|                  |                                          |
|                  v                                          |
|   [ Shared Physical Simulation Substrate ]                  |
|    - Microscopic Weidmann speed-density deceleration        |
|    - Deterministic FIFO exit & doorway bottleneck queues    |
|    - Exact fractional throughput service accumulation       |
|    - Mobility categories (Standard, Wheelchair, Slow)       |
|    - Dynamic hazard exposure integration                    |
|                  |                                          |
|                  v                                          |
|         [ Metrics Engine & Telemetry ]                      |
|          - Total / median / 95th percentile evacuation time |
|          - Local crowd density & exit queue bottlenecks     |
|          - Instantaneous & windowed exit throughput         |
|          - Cumulative hazard dosage                         |
+-------------------------------------------------------------+
```

## 2. Navigation Graph Formulation
The spatial navigable environment is represented as a directed graph $G = (V, E)$:
- **Vertices ($V$):** Room centroids, corridor intersections, intermediate corridor discretizations (every 4 meters), doorways, and exterior exits.
- **Edges ($E$):** Navigable passages connecting adjacent nodes.
- **Attributes on $e = (u, v) \in E$:**
  - $L(e)$: Euclidean length in meters: $L(e) = \sqrt{(x_v - x_u)^2 + (y_v - y_u)^2}$.
  - $W(e)$: Effective corridor/door width in meters.
  - $A(e) = L(e) \cdot W(e)$: Navigable surface area in $\text{m}^2$.
  - $C(e)$: Flow capacity in occupants/second, derived from standard building egress codes: $C(e) = \min(W(e) \cdot 1.33, \text{ExitCapacity})$.
  - $\text{Acc}(e) \in \{0, 1\}$: Wheelchair accessibility indicator ($0$ if stairs or narrow threshold $< 0.9\text{m}$, $1$ if level/ramp).
  - $H(e, t) \in [0, 1]$: Dynamic hazard index (fire/smoke intensity along edge at time $t$).

## 3. Realistic Crowd Dynamics & Movement Physics

### 3.1 Local Density Calculation
At discrete time step $t$, the local crowd density $\rho_e(t)$ on edge $e$ is:
$$\rho_e(t) = \frac{N_e(t)}{\max(1.0, A_e)} \quad [\text{persons} / \text{m}^2]$$
where $N_e(t)$ is the count of active agents traversing edge $e$.

### 3.2 Calibrated Continuous Weidmann Speed-Density Model
Pedestrians slow down as surrounding density $\rho_e$ rises. We implement a continuous, non-linear Weidmann relationship with parameters:
- $\rho_{\max} = 5.4 \text{ persons/m}^2$ (jam / crush density)
- $\gamma = 1.913$ (sensitivity exponent)
- $v_{\min\_ratio} = 0.08$ ($8\%$ crawl speed floor to prevent complete computational deadlock)

The effective velocity $v_i(t)$ of occupant $i$ with unimpeded free speed $v_{i,0}$ is:
$$v_i(t) = \begin{cases} 
v_{i,0} & \text{if } \rho_e \le 0.15 \text{ pers/m}^2 \\
v_{i,0} \cdot \left[ v_{\min\_ratio} + (1 - v_{\min\_ratio}) \cdot \left(1 - \exp\left(-\gamma \cdot \left(\frac{1}{\rho_e} - \frac{1}{\rho_{\max}}\right)\right)\right) \right] & \text{if } 0.15 < \rho_e < \rho_{\max} \\
v_{i,0} \cdot v_{\min\_ratio} & \text{if } \rho_e \ge \rho_{\max}
\end{cases}$$

This formulation guarantees:
1. $v_i(t) > 0$ strictly positive (no negative velocities or unphysical backward flow).
2. Strict monotonic decrease as density increases.
3. As $\rho_e \to \rho_{\max}$, $v_i \to v_{i,0} \cdot v_{\min\_ratio}$ smoothly without threshold discontinuities.

## 4. Deterministic Doorway & Exit Queuing

### 4.1 Fractional Throughput Accumulation
Each exit $j$ has an operational flow limit $C_j$ in persons/second. Because time step $dt$ may produce a non-integer capacity $C_j \cdot dt$, we track a continuous service budget:
$$\text{budget}_j(t + dt) = \text{budget}_j(t) + C_j \cdot dt$$
$$\text{serviced}_j = \min\left( \lfloor \text{budget}_j(t + dt) \rfloor, \, \text{len}(\text{Queue}_j) \right)$$
$$\text{budget}_j(t + dt) \leftarrow \text{budget}_j(t + dt) - \text{serviced}_j$$

This guarantees:
- Over any time window $T$, total evacuees through exit $j$ equals $\lfloor C_j \cdot T \rfloor$.
- Invariance to step size $dt$ ($dt=0.1, 0.25, 0.5, 1.0$).
- Strict FIFO fairness: the first agent to reach the doorway or exit portal is the first agent cleared.
- No duplicate queue entry or lost agents.

## 5. Critical Fairness Substrate
The Phase 2 crowd model serves as the **identical, immutable physical simulation engine** for both:
- Baseline shortest-path routing
- Phase 3 EXIT-ZERO adaptive predictive routing

This guarantees that performance improvements measured in subsequent phases reflect algorithmic route optimization, not discrepancies in physical crowd simulation rules.
