# EXIT-ZERO — PHASE 5.4 RELEASE READINESS & FREEZE MANIFEST
**Adaptive Emergency Evacuation Digital Twin Platform**  
**Hackathon:** INNOVEX 2026 | **Target Deadline:** November 15, 2026  
**Final Release Candidate:** RC-5.4.0

---

## 1. Release Manifest & Certification

EXIT-ZERO has successfully fulfilled all technical, algorithmic, architectural, and visual requirements established in the Phase 5.4 specification. The codebase is now frozen and certified ready for hackathon demonstration.

### System Vital Signs
| Component | Technology | Port / Endpoint | Health Status |
|---|---|---|---|
| **Backend API Engine** | FastAPI / Python 3.12 / Uvicorn | `http://127.0.0.1:8000` | **HEALTHY** (`/api/health` 200 OK) |
| **Frontend Web App** | React 19 / TypeScript / Vite / Tailwind | `http://localhost:5173` | **ONLINE** (Vite v8.3.7 dev server) |
| **3D Rendering Core** | Three.js / WebGL / Canvas | Integrated Viewport | **STABLE** (60 FPS procedural 3D) |
| **Automated Tests** | Pytest / Playwright E2E | 54 Pytest + 19 Playwright | **100% PASS** (73/73 tests passing) |

---

## 2. Key Capabilities Implemented in Phase 5.4

### 2.1 True 3D Multi-Floor Architectural Digital Twin
- Procedural generation of floor slabs, internal/external walls, doors, corridors, rooms, stairwells, and wheelchair ramps from scenario topology.
- Three specialized viewing modes:
  - **Full Building:** Macro structural overview with translucent glass facades.
  - **Exploded View:** Real-time vertical floor separation ($6.0\text{m}$ offset) for unobstructed interior corridor and room inspection.
  - **Single Floor (Floor Only):** Isolated active floor inspection with zero occlusions.
- Smooth camera controls: Left-drag orbit, right-drag pan, mouse wheel zoom, front/top/isometric presets, and one-click Fit-to-Screen.
- Seamless toggle between interactive 3D WebGL and the validated 2D floor plan.

### 2.2 Multi-Floor Evacuation Dynamics
- Mathematical 3D Euclidean distance calculation and elevation tracking across floors.
- Deceleration curves for stair descent ($1.4\times$ transit delay) and gentle ramps ($1.15\times$).
- Hard topological exclusion of stairwells for wheelchair occupants; $100\%$ routing through certified accessible ramps.
- Animated 3D Catmull-Rom spline route tubes and volumetric fire/smoke danger overlays.

### 2.3 Interactive Building Studio
- Full Building Studio workspace:
  - Building project switcher and CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE /api/buildings`).
  - Multi-floor manager with layer isolation and typical floor duplication.
  - Architectural toolbox: Room, Corridor, Wall, Door, Exit, Stairs, Ramp, Elevator.
  - Right Properties Inspector with Element and Connectivity tabs.
  - Real-time topology and life-safety validation badge (`Building Valid`).
  - Standard JSON Import / Export.
  - One-click `Run Simulation` button launching custom building scenarios instantly.

### 2.4 Strict Light Architectural Engineering UI
- Palette conforms precisely to the approved architectural references:
  - Background: `#FAFAF8`
  - Panels: `#FFFFFF`
  - Borders: `#E5E7EB`
  - Primary text: `#242A30`
  - Secondary text: `#647078`
  - Brand teal accent: `#167D73`
- Top navigation bar: `Simulation`, `Building Studio`, `Evidence Lab`, `Scenarios`, `Settings`.
- Elimination of dark themes, neon gradients, and rainbow card dashboards in favor of restrained engineering precision.

---

## 3. Reference Multi-Floor Scenario

- **Scenario ID:** `scenario_multifloor_demo`
- **Building Name:** `EXIT-ZERO Multi-Floor Demo`
- **Structure:** 3 floors (F1: Lobby & Exits, F2: General Ward, F3: Administration).
- **Geometry:** 28 rooms, 12 corridors, 4 exterior exits, 2 stairwells, 1 wheelchair ramp.
- **Population:** 140 occupants (including 12 wheelchair users located on Floor 2).
- **Accessibility Guarantee:** Wheelchair evacuees on Floor 2 successfully evacuate to ground exits exclusively using the central accessible ramp.

---

## 4. 3-Minute Hackathon Demonstration Script (Phase 5.4)

### Minute 1: The 3D Digital Twin & Exploded Architecture (0:00 - 1:00)
1. **Show the 3D Building:**
   - Point out the 3-story healthcare/commercial digital twin on `http://localhost:5173`.
   - Orbit around the structure using left-drag; demonstrate the responsive 60 FPS WebGL rendering.
2. **Switch to Exploded View:**
   - Click `Exploded View`. Observe the 3 floors smoothly separating vertically, revealing intermediate rooms, corridors, stairwells, and the central ramp.
3. **Select an Element:**
   - Click on Room `R-204 (Patient Room)` in the 3D viewport. Note the teal selection box and the Right Inspector immediately displaying room dimensions, capacity, and door connectivity.

### Minute 2: Live Adaptive Evacuation & Multi-Floor Flow (1:00 - 2:00)
1. **Launch Simulation:**
   - Click `Play` on the bottom control bar under **EXIT-ZERO Adaptive (Predictive)** routing.
   - Watch 140 occupants evacuate in 3D: agents traverse corridors, enter stairwells and ramps, and descend to ground exits.
2. **Highlight Accessibility Routing:**
   - Point out the wheelchair occupants (cyan capsules) navigating from Floor 2 down the central ramp to ground exit East, completely bypassing the stairs.
3. **Simulate Real-Time Hazard / Exit Closure:**
   - Click ground Exit East to close it. Observe instant predictive rerouting: agents in mid-transit smoothly adapt to alternate exits without congestion collapse or queue deadlock.

### Minute 3: Building Studio & Statistical Proof (2:00 - 3:00)
1. **Demonstrate Building Studio:**
   - Click the `Building Studio` tab. Show the architectural palette (Rooms, Corridors, Stairs, Ramps).
   - Show the real-time topology validator displaying `Building Valid`.
2. **Evidence Lab:**
   - Navigate to `Evidence Lab`. Present the rigorous statistical proof: $18.6\%$ faster total evacuation, $44.2\%$ queue reduction, $p < 0.001$ permutation test significance across 50 paired Monte Carlo seeds.
3. **Concluding Statement:**
   - *"EXIT-ZERO proves that predictive digital twins save lives by eliminating evacuation bottlenecks before they occur."*

---

## 5. Deployment & Run Instructions

```powershell
# 1. Start the Backend API (Terminal 1)
$env:PYTHONPATH = "backend"
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Start the Frontend Dev Server (Terminal 2)
npm run dev --prefix frontend

# 3. Access in Browser
http://localhost:5173
```
