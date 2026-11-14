# EXIT-ZERO — BUILDING STUDIO USER GUIDE
**Architectural Digital Twin Creation, Floor Editing & Evacuation Topology Engine**  
**Hackathon:** INNOVEX 2026 | **Target Deadline:** November 15, 2026

---

## 1. Overview

The **Building Studio** is EXIT-ZERO's interactive digital twin creation and configuration environment. It enables architectural engineers, emergency responders, and simulation researchers to:
1. Design multi-story building topologies from scratch or modify existing models.
2. Place and configure rooms, corridors, walls, doors, exits, stairwells, and wheelchair-accessible ramps.
3. Validate graph connectivity and accessibility compliance in real time.
4. Export and import standard JSON building definitions.
5. Launch live evacuation simulations directly on custom buildings with zero configuration friction.

---

## 2. Interface Layout

The Building Studio adheres strictly to the light architectural engineering design system:

```
+----------------------------------------------------------------------------------------------------+
|  EXIT-ZERO® | Evacuation Digital Twin    [Simulation]  [Building Studio]*  [Evidence Lab]  [Settings]   |
+----------------------------------------------------------------------------------------------------+
| [Project]            | [3D View] [2D Plan]    [Full Building] [Exploded] [Single] | Properties     |
| EXIT-ZERO Multi-Floor|                                                             | [Element] [Conn]
|                      |                                                             | Room R-204     |
| [Floors]             |                                                             | Floor: F2      |
| [👁 F3 - Admin]      |                     3D WebGL                                | Length: 8.00m  |
| [👁 F2 - General]*   |                  ARCHITECTURAL                              | Width:  6.00m  |
| [👁 F1 - Lobby]      |                     VIEWPORT                                | Height: 3.20m  |
|                      |                                                             | Area:   48.0m² |
| [Add Elements]       |                                                             | Capacity: 6    |
| [Room]   [Corridor]  |                                                             | [x] Accessible |
| [Door]   [Exit]      |                                                             |                |
| [Stairs] [Ramp (Acc)]|                                                             | Doors:         |
|                      |                                                             | - D-201 (C-203)|
| [Editing Tools]      |                                                             | - D-202 (C-204)|
| [Select] [Move]      | [x] Grid Snap  [x] Snap to Walls   Grid: 0.50m  [3D] [Fit]  |                |
+------------------------------------------------------------------------------------+----------------+
| Building: Multi-Floor Demo | Floors: 3 | Rooms: 28 | Corridors: 12 | Exits: 4 | Cap: 720 | [✓ Valid] |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Core Architectural Elements

The Studio provides eight specialized BIM primitives:

| Element | Tool Icon | Description & Physical Attributes |
|---|---|---|
| **Room** | Square Box | Occupancy zone. Attributes: length, width, height, classification (Office, Ward, Lab, Utility), max capacity, wheelchair accessibility tag. |
| **Corridor** | Parallel Lines | Linear transit segment. Attributes: width ($1.0\text{m} - 5.0\text{m}$), length, crowd density limits, fire barrier rating. |
| **Wall** | Solid Bar | Structural or partition boundary. Restricts agent movement; absorbs acoustic and thermal radiation. |
| **Door** | Open Portal | Gateway between rooms and corridors. Attributes: width ($0.9\text{m} - 2.4\text{m}$), flow coefficient ($peds/sec$), swing direction. |
| **Exit** | Running Person | Ground-level exterior egress point. Attributes: discharge width, flow capacity ($peds/m/sec$), emergency status (Open / Closed). |
| **Stairs** | Stepped Glyphs | Vertical transit element connecting adjacent floors. Ambulatory-only transit; excluded from wheelchair routing. Incline factor $1.4\times$ transit delay. |
| **Ramp (Accessible)** | Wheelchair Incline | ADA-compliant slope ($\le 1:12$). Certified for wheelchair and reduced-mobility evacuees. Incline factor $1.15\times$ transit delay. |
| **Elevator** | Shaft Box | Visual vertical transport core. Automatically disabled during fire alarms in compliance with NFPA 101 Life Safety Code. |

---

## 4. Floor Management & Layer Controls

1. **Floor Reordering & Elevation:**
   - Click `+ Add Floor` to create a new upper or lower level.
   - Set custom elevations (e.g., $0.0\text{m}$, $3.8\text{m}$, $7.6\text{m}$).
   - Toggle visibility (`👁`) to isolate specific floors during complex layouts.
2. **Floor Duplication:**
   - Duplicate typical floor plans (e.g., repeating office/ward floors) with one click to rapidly build high-rise structures.
3. **Exploded Separation Adjustment:**
   - In 3D Exploded mode, adjust the vertical slider to expand floor separation from $2.0\text{m}$ up to $15.0\text{m}$ for clear interior corridor inspection.

---

## 5. Real-Time Topology & Compliance Engine

The Building Studio includes a continuous validation engine that inspects the building geometry every time an element is added, moved, or resized:

1. **Egress Reachability Rule:**
   - Every room and corridor node MUST have at least one continuous, non-intersected path to a ground-level exit.
   - Any disconnected room is immediately flagged with an amber warning: *"Room R-XXX is an isolated dead end with no door connection to a corridor."*
2. **ADA Mobility Rule:**
   - Accessible rooms on upper levels MUST have at least one continuous route through ramps or designated evacuation lifts to an accessible exit.
   - If an upper floor contains accessible rooms but only features standard staircases, the validator warns: *"Upper floor accessible zones lack continuous ramp egress."*
3. **Exit Capacity Rule:**
   - Total building occupant capacity is cross-referenced with aggregate exit discharge widths according to NFPA 101 standards ($0.2\text{ in/person}$ or $5.0\text{ mm/person}$).
4. **Status Indicator:**
   - When all checks pass, the bottom status bar displays a green badge: `[✓ Building Valid]`.
   - Clicking the badge opens the complete diagnostic report with exact node metrics.

---

## 6. Export, Import & Simulation Execution

### 6.1 JSON Serialization
Buildings are stored in clean, human-readable JSON adhering to the `Building` schema:
```json
{
  "id": "building_hospital_tower",
  "name": "General Hospital Wing A",
  "author": "Architectural Safety Team",
  "version": "1.0.0",
  "floors": [ ... ],
  "stairwells": [ ... ],
  "exterior_exits": [ ... ]
}
```
- **Export:** Click `Export` to save the JSON file locally for version control or team review.
- **Import:** Click `Import` to drag-and-drop any standard EXIT-ZERO building file.

### 6.2 Instant Simulation Launch
Click `Run Simulation` in the top right header:
1. The Building Studio sends the building topology to `POST /api/buildings/{id}/run`.
2. The backend generates the 3D multi-floor navigation graph, populates occupants according to room capacity, and starts the simulation session.
3. The interface seamlessly transitions to the **Simulation Viewport**, allowing the user to compare Baseline vs. EXIT-ZERO adaptive routing on their custom structure in real time.
