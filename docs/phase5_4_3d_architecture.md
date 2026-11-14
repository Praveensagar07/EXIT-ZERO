# EXIT-ZERO — PHASE 5.4: TRUE 3D DIGITAL TWIN ARCHITECTURE
**Adaptive Emergency Evacuation Digital Twin Platform**  
**Hackathon:** INNOVEX 2026 | **Target Deadline:** November 15, 2026  
**Status:** Certified Release Candidate (Phase 5.4)

---

## 1. Executive Summary

Phase 5.4 elevates **EXIT-ZERO** from a planar 2D evacuation simulator to a true 3D multi-floor architectural digital twin. The application renders full-scale multi-level buildings directly in WebGL using **Three.js** inside the modern React 19 ecosystem without relying on heavyweight game engines or proprietary binary assets.

The 3D environment maintains a strict, mathematical 1:1 bidirectional coupling with the backend simulation graph:
1. Every physical floor slab, wall, room, door, corridor, exit, staircase, and ramp is procedurally extruded from the scenario topology.
2. Every simulation agent $(x, y, z)$ is rendered as an interactive, color-coded 3D capsule with real-time velocity orientation.
3. Evacuation routes are rendered as glowing 3D Catmull-Rom spline tubes spanning multiple floors through stairwells and ramps.
4. Active hazard sources (smoke and fire) are volumetric 3D particle systems whose physical radii match backend hazard propagation thresholds.

---

## 2. Spatial Coordinate System & Units

EXIT-ZERO adheres to standard ISO architectural engineering spatial coordinates:
- **X-axis (East/West):** Horizontal lateral span across the floor plan (meters).
- **Y-axis (Elevation / Vertical):** Upward architectural elevation ($Z$ in typical architectural BIM, mapped to $Y$ in Three.js standard coordinates).
- **Z-axis (North/South):** Longitudinal depth across the floor plan (meters).
- **1 Unit = 1.000 Meter:** Direct scale equivalence ensures all velocity calculations ($m/s$), queue densities ($agents/m^2$), and egress flows ($peds/m/s$) correspond directly to physical reality.

### Floor Elevation Mapping
For a building with $N$ floors, each floor $f \in [0, N-1]$ is positioned at:
$$Y_{\text{base}}(f) = \text{elevation}(f) + \text{offset}_{\text{exploded}}(f)$$
Where:
- $\text{elevation}(f)$ is the physical floor elevation specified in meters (e.g., Ground = $0.0\text{m}$, Floor 2 = $3.8\text{m}$, Floor 3 = $7.6\text{m}$).
- $\text{offset}_{\text{exploded}}(f)$ is dynamically injected in **Exploded View Mode**:
  $$\text{offset}_{\text{exploded}}(f) = f \times 6.0\text{m}$$

---

## 3. Procedural Geometry Generation

### 3.1 Floor Slabs
- **Geometry:** `THREE.BoxGeometry(width, slab_thickness, height)` with slab thickness set to $0.25\text{m}$.
- **Material:** Light architectural concrete finish (`#F3F4F6` base color, roughness $0.85$, metalness $0.05$).
- **Beveling & Edges:** Outer edges highlighted with subtle gray borders (`#E5E7EB`) for contrast.

### 3.2 Interior and Exterior Walls
- **Geometry:** Generated from corridor bounds and room perimeters using `THREE.BoxGeometry(length, wall_height, wall_thickness)` with default wall height $3.0\text{m}$ and wall thickness $0.20\text{m}$.
- **Material:** Light architectural plaster (`#E5E7EB`, roughness $0.90$).
- **Door Cutouts:** Door portals are extruded with clear passage headers ($2.2\text{m}$ clearance) matching physical door coordinates.

### 3.3 Rooms and Occupancy Zones
- **Floor Inlays:** Semi-translucent colored boundaries denoting room designation (e.g., patient rooms, offices, laboratories).
- **Active Selection Highlight:** When an element is selected in the viewport or studio inspector, a teal bounding highlight (`#167D73`, opacity $0.35$) with an animated wireframe outline is projected over the room footprint.

### 3.4 Vertical Connectors: Stairwells & Wheelchair Ramps
- **Stairwells:** Procedurally generated step geometries (step run $0.28\text{m}$, step rise $0.17\text{m}$) enclosed by safety balustrades. Visualized in muted slate with emergency directional arrows.
- **Wheelchair Ramps:** Constant slope inclined planes ($\le 1:12$ ADA compliant incline) with accessible safety handrails and international wheelchair accessibility emblems (`#0284C7`).

### 3.5 Emergency Exits
- Ground-level and exterior egress points feature illuminated green emergency exit portals (`#059669`) with running-person iconography and volumetric egress light cones.

---

## 4. Multi-View Rendering Modes

The 3D digital twin provides three specialized visualization modes:

| Mode | View Description | Primary Use Case |
|---|---|---|
| **Full Building** | Entire building rendered as an integrated multi-story monolithic structure with translucent glass facades. | Macro building inspection, overall building capacity evaluation, and ingress/egress bottleneck analysis. |
| **Exploded View** | Floors are vertically separated by an offset of $6.0\text{m}$ along the Y-axis. Stair and ramp connections extend dynamically across separated levels. | Interactive inspection of intermediate floor corridors, internal room layouts, and cross-floor evacuation flows. |
| **Single Floor (Floor Only)** | Only the currently selected active floor is rendered, hiding all other floors and vertical structural occlusions. | Micro-level evacuation planning, detailed room property inspection, and localized door/corridor editing. |

---

## 5. Agent & Route Dynamics in 3D

### 5.1 Occupant Meshes
Occupants are rendered as low-poly capsules with directional caps:
- **Standard Ambulatory Agents:** Rendered in neutral charcoal/slate (`#374151`).
- **Reduced Mobility / Wheelchair Agents:** Rendered in international accessibility cyan (`#0284C7`) with distinct circular base discs.
- **Rerouting / Evacuating State:** Agents dynamically adjust coloration when executing emergency re-planning (flashing amber `#D97706`).

### 5.2 3D Flowing Route Lines
Evacuation trajectories are computed from backend Dijkstra path nodes and rendered using `THREE.CatmullRomCurve3` tube geometries:
- Tubes maintain a radius of $0.08\text{m}$ elevated $0.15\text{m}$ above floor surfaces to prevent z-fighting.
- Multi-floor routes smoothly ascend/descend through staircases and ramps using continuous 3D spline tangents.
- Flow pulses are animated along the curve using texture UV coordinate offsets, intuitively communicating egress directions to judges and safety officers.

### 5.3 Volumetric Hazards
- **Smoke Volumes:** Rendered as semi-transparent expanding ellipsoids (`#4B5563`, opacity $0.40$) whose boundary coordinates expand according to the physical smoke propagation model.
- **Fire Cores:** Inner high-hazard danger zones rendered in thermal orange/red (`#DC2626`, pulsating emissive material) with heat shimmer particle billboarding. Corridors exceeding the critical hazard threshold ($0.85$) display impassable visual barriers.

---

## 6. Camera Controls, Raycasting & Performance Optimizations

### 6.1 Camera & Viewport Navigation
- **Perspective Camera:** $45^\circ$ FOV, near clipping plane $0.1\text{m}$, far clipping plane $1000\text{m}$.
- **OrbitControls:** 
  - Left Mouse Drag: Orbit around focal target.
  - Right Mouse Drag / Middle Mouse: Smooth pan in camera plane.
  - Mouse Wheel: Geometric zoom with min/max distance clamping ($5.0\text{m}$ to $200.0\text{m}$).
  - View presets: Front, Top, Isometric, and Fit-to-Screen (`handleFitToView`) with smooth linear interpolation.

### 6.2 Interactive Element Raycasting
- Pointer hover and click events project a raycast from camera coordinates through normalized device coordinates (NDC).
- Intersected meshes are queried for userData tags (`elementId`, `floorId`, `elementType`).
- Selected rooms, corridors, or exits trigger instant synchronization with the Right Properties Inspector and Studio validation engine.

### 6.3 Performance & Frame Rate Guarantees
- **Geometry Instancing:** Identical architectural features (doors, windows, balusters) share instanced buffers, reducing draw calls from $>1200$ to $<45$.
- **Frustum Culling:** Enabled by default on all floor groups. In Single Floor mode, unselected floor object trees are completely detached from the scene graph.
- **Frame Rate Target:** Sustained 60 FPS on standard integrated GPUs (tested on Intel Iris Xe / Apple Silicon / standard laptop discrete graphics).
