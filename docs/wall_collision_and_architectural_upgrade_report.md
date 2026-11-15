# EXIT-ZERO — Wall Collision Prevention & Architectural Upgrade Validation Report
**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Repository:** `https://github.com/Praveensagar07/EXIT-ZERO.git`  
**Date:** November 15, 2026  
**Status:** VALIDATED & PRODUCTION-READY (All 85 Automated Tests & 8 Browser Acceptance Tests Passing)  

---

## 1. Executive Summary

During Phase 5.6 and urgent triage, visual inspection identified a critical simulation correctness defect: occupants were observed crossing directly through solid partition walls and approaching active fire boundaries without proper wall avoidance. Simultaneously, the visual rendering of the building required an upgrade from basic gray boxes to a professional architectural digital twin matching high-detail BIM reference standards (transparent curtain wall facades, dark aluminum mullions and transoms, physical doorway apertures with jambs and lintels, structural columns, and an architectural foundation plinth).

This engineering cycle resolved both challenges:
1. **P0 Computational Geometry Fix:** Enforced strict geometric collision clearance between all navigation graph edges and solid building walls. Agents can now only transition between rooms and corridors through physically open doorways.
2. **P0 Fire Avoidance Hardening:** Verified multi-objective routing costs $J(e)$, emergency replanning hysteresis, and corridor exclusion under intense smoke and heat.
3. **P1 3D Architectural Upgrade:** Implemented architectural glass facades with dark aluminum mullions, realistic floor slabs, structural columns, physical wall cutouts for doorways with overhead lintels, illuminated doorway plaques, and a foundation podium plinth.
4. **14 New Automated Tests:** Created `backend/tests/test_wall_collision_and_architecture.py`, testing every wall collision edge case. All 14 tests passed (100%).
5. **Full Regression Validation:** Executed the entire backend test suite; **all 85 tests across 11 test suites passed with zero errors**.
6. **Live Browser Acceptance (Tests A–H):** Validated in Microsoft Edge via Playwright, capturing all 8 photographic evidence artifacts.

---

## 2. Root Cause Analysis: Wall Penetration & Geometric Routing

### 2.1 The Root Cause
Previous versions of `BuildingGraphGenerator` placed corridor waypoints at fixed coordinates across the floor bounding box (e.g. $y=10.5\text{m}$ and $y=34.5\text{m}$) without checking if those coordinates overlapped room interiors. Furthermore, candidate edges were connected between room centers and nearby nodes without checking for line-segment intersection against solid perimeter walls. When an occupant spawned inside a room, the path to an exit often formed a straight line that cut straight through partition drywall.

### 2.2 Computational Geometry Resolution
1. **Solid Wall Line Extraction (`extract_solid_wall_segments`):**
   - For every room boundary wall, candidate doorways are evaluated.
   - For open doors, the boundary wall is mathematically split into two distinct solid segments on either side of the doorway aperture: $[x_{\min}, x_{\text{door}} - w/2]$ and $[x_{\text{door}} + w/2, x_{\max}]$.
   - Closed doors (`is_open=False`) retain 100% solid barrier geometry without aperture cuts.
   - Non-passable obstacles (e.g. walls added in Building Studio) generate solid boundary segments.
2. **Robust 2D Line-Segment Intersection (`segments_intersect` & `edge_intersects_any_wall`):**
   - Implemented 2D orientation cross-product algorithm (`ccw`) to rigorously test whether any proposed graph edge $(p_1, p_2)$ intersects any solid wall segment $(w_1, w_2)$.
   - Edges that intersect solid walls are strictly rejected from the graph.
3. **Collision-Free Corridor Spine Generation:**
   - Corridor spine waypoints are now verified with `point_in_any_room()`. Waypoints inside rooms are discarded, ensuring the circulation spine exists exclusively in open hallways.
   - Corridors connect to room doorways via dedicated perpendicular approach nodes with clear line-of-sight.
4. **Initial Spawn Room Anchoring:**
   - In `SimulationEngine._find_nearest_navigable_node()`, if an occupant spawns inside a room, they are strictly anchored to `node_room_{r.id}`. Occupants cannot reach corridor nodes except through designated room doorways.

---

## 3. 3D Architectural Upgrade Implementation

In `frontend/src/components/BuildingViewport3D.tsx`, the building rendering was transformed to match the architectural reference target (`media_1794723573635_819bfc53.jpg`):

1. **Physical Doorway Apertures (`buildWallWithOpenings`):**
   - Solid extruded boxes for walls were replaced with segmented meshes:
     - Left wall post
     - Right wall post
     - Overhead lintel beam ($y \in [2.3\text{m}, 3.0\text{m}]$)
   - Leaves an open, passable aperture ($w=1.2\text{m} - 1.8\text{m}, h=2.3\text{m}$) through which occupants visually walk.
2. **Architectural Door Frames & Directional Exit Plaques:**
   - Added dark aluminum casing/jambs around all door openings.
   - Illuminated emergency exit signs above exit doorways with safety green luminescence (`#167D73` / `#059669`).
3. **Exterior Curtain Wall Glass & Aluminum Mullions:**
   - Transparent exterior glazing (`opacity: 0.22`, `transmission: 0.90`, `roughness: 0.10`).
   - Vertical dark-aluminum mullions spaced at $4.0\text{m}$ intervals.
   - Horizontal structural transoms at sill height ($1.2\text{m}$) and lintel height ($2.4\text{m}$).
4. **Structural Columns & Floor Slabs:**
   - Reinforced concrete corner and interior columns ($0.5\text{m} \times 0.5\text{m}$).
   - Multi-layer floor slabs with ceiling trim and beveled edges.
5. **Architectural Foundation Podium Plinth:**
   - Realistic stepped ground pedestal at $y=-0.65\text{m}$ with beveled curbing and perimeter green landscaping trim.
6. **Subtle Lighting & Material Balance:**
   - Directional sun casting soft shadows, ambient fill, and subtle interior floor illumination (`#FAFAF8` background, `#1E293B` metal framing, `#167D73` brand accents).

---

## 4. Automated Test Suite Results

### 4.1 New Specialized Test Suite: `test_wall_collision_and_architecture.py`
All 14 tests executed and passed in 2.22s:

| # | Test Name | Objective & Assertion | Result |
|---|---|---|:---:|
| 1 | `test_1_agent_cannot_cross_solid_wall` | Edge intersecting solid room wall is strictly excluded from graph | **PASSED** |
| 2 | `test_2_agent_passes_through_valid_doorway` | Path from room center to corridor passes through doorway node | **PASSED** |
| 3 | `test_3_closed_door_prevents_passage` | Closed doorway treats aperture as solid wall, preventing egress | **PASSED** |
| 4 | `test_4_new_wall_invalidates_intersecting_routes` | Dynamic partition wall invalidates intersecting edges | **PASSED** |
| 5 | `test_5_new_door_updates_connectivity` | Adding communicating door creates valid inter-room route | **PASSED** |
| 6 | `test_6_fire_blocks_previously_valid_route` | Active fire increases edge cost, forcing path diversion | **PASSED** |
| 7 | `test_7_emergency_replanning_selects_feasible_alternative` | Fire blocking primary stair diverts occupants to alternate stair | **PASSED** |
| 8 | `test_8_no_feasible_route_produces_trapped_state` | Complete fire enclosure marks agent trapped safely without jumping | **PASSED** |
| 9 | `test_9_agent_cannot_pass_through_floor_slabs` | Floor elevations strictly preserved; agents cannot penetrate slabs | **PASSED** |
| 10 | `test_10_stair_traversal_follows_valid_geometry` | Vertical transitions occur exclusively via defined stairwell/ramp edges | **PASSED** |
| 11 | `test_11_wheelchair_routes_respect_accessibility` | PRM / wheelchair occupants strictly restricted to ramps and accessible exits | **PASSED** |
| 12 | `test_12_building_edits_trigger_navigation_validation` | Studio modifications trigger topology audit and cache rebuild | **PASSED** |
| 13 | `test_13_deterministic_replay_with_fixed_inputs` | Identical seed produces bit-exact trajectory replays | **PASSED** |
| 14 | `test_14_existing_benchmark_scenarios_remain_functional` | Benchmark scenarios A/B/C maintain valid evacuation metrics | **PASSED** |

### 4.2 Full Backend Regression Suite
Command: `$env:PYTHONPATH = "backend"; backend\.venv\Scripts\python.exe -m pytest backend/tests/ -v`  
**Result:** **85 PASSED, 0 FAILED** in 15.27s.
- `test_adaptive_intelligence.py`: 11 passed
- `test_api.py`: 7 passed
- `test_cache_and_routing_correctness.py`: 5 passed
- `test_crowd_simulation.py`: 11 passed
- `test_experiments_and_fairness.py`: 10 passed
- `test_graph_generator.py`: 3 passed
- `test_models.py`: 3 passed
- `test_multifloor_and_studio.py`: 6 passed
- `test_phase5_6_guidance_and_import.py`: 5 passed
- `test_physics_fire_avoidance.py`: 10 passed
- `test_wall_collision_and_architecture.py`: 14 passed

---

## 5. Live Browser Acceptance Testing (Tests A – H)

Executed via Playwright in Microsoft Edge against `http://localhost:5173`. All 8 evidence screenshots captured in `docs/evidence_screenshots/`:

| Test | Test Description | Evidence Artifact | Status |
|:---:|---|---|:---:|
| **A** | **Realistic 3D Architectural Building**<br>Inspected outer framing, glass curtain wall with mullions, visible interior rooms, structural columns, foundation plinth, and soft shadows. | `docs/evidence_screenshots/acceptance_3d_architectural_building.png` | **VERIFIED** |
| **B** | **Physical Doorway Openings**<br>Zoomed into rooms showing physical wall openings (left post, right post, lintel), aluminum frames, and occupants exiting through door openings. | `docs/evidence_screenshots/acceptance_doorway_physical_openings.png` | **VERIFIED** |
| **C** | **Multi-Occupant Egress & Wall Clearance**<br>Observed occupants leaving multiple rooms simultaneously, queuing naturally at doorway bottlenecks, maintaining wall clearance, and turning into corridor spines without clipping drywall corners. | `docs/evidence_screenshots/acceptance_egress_wall_clearance.png` | **VERIFIED** |
| **D** | **Fire Avoidance & Safe Detours**<br>Simulated fire onset at $t=8\text{s}$. Occupants near the hazard immediately re-route away from heat/smoke along alternate safe corridors. | `docs/evidence_screenshots/acceptance_fire_avoidance_and_replanning.png` | **VERIFIED** |
| **E** | **Stair & Ramp Vertical Continuity**<br>Observed continuous descent across floors. Ambulatory occupants descend stair treads; wheelchair occupants utilize the central accessible ramp without dropping or floating. | `docs/evidence_screenshots/acceptance_stair_ramp_vertical_continuity.png` | **VERIFIED** |
| **F** | **Accessibility Compliance**<br>Verified wheelchair occupants adhere strictly to accessible paths, avoiding stairs and exiting through designated ramp exits. | `docs/evidence_screenshots/acceptance_wheelchair_accessible_routes.png` | **VERIFIED** |
| **G** | **Building Studio Wall & Door Editing**<br>Opened Building Studio, selected building elements, verified dimension tags in meters, real property panels, and immediate 3D viewport synchronization. | `docs/evidence_screenshots/acceptance_building_studio_wall_door_editing.png` | **VERIFIED** |
| **H** | **Exploded View & Floor Isolation**<br>Toggled Exploded View and Single Floor isolation. Floor slabs separate cleanly with visible room partitions and illuminated floor indicators. | `docs/evidence_screenshots/acceptance_exploded_view_and_floor_isolation.png` | **VERIFIED** |

---

## 6. Conclusion & Submission Readiness

The EXIT-ZERO digital twin platform now combines rigorous physical simulation accuracy with architectural 3D rendering. Agents strictly obey spatial geometry, traversing only through physical doorway apertures and avoiding fire hazards. The platform is robust, verified across 85 automated tests, and ready for live hackathon demonstration at INNOVEX 2026.
