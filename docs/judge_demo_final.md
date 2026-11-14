# EXIT-ZERO — 3-Minute Judge Demonstration & Presentation Guide
**Event:** INNOVEX 2026 Hackathon  
**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Target Duration:** Exactly 3 minutes (180 seconds)  
**Presenter:** Software Architect & Simulation Engineer  

---

## 1. Executive Summary & Demo Mission

EXIT-ZERO is an intelligent, physics-constrained emergency evacuation digital twin that demonstrates how predictive, congestion-aware, and accessibility-constrained routing significantly outperforms conventional static shortest-path building egress during emergencies.

---

## 2. 3-Minute Narration & Screen Action Timeline

```
+--------------------------------------------------------------------------------------------------------+
| TIME        | SECTION                            | SCREEN ACTION                      | NARRATIVE FOCUS |
+--------------------------------------------------------------------------------------------------------+
| 00:00-00:30 | Problem & Mission                  | Title screen / Dashboard Overview  | The 100-year-old flaw in egress
| 00:30-01:00 | Baseline Shortest-Path Egress      | Step 1 & 2 in Walkthrough HUD     | The rush to the nearest door
| 01:00-01:45 | EXIT-ZERO Adaptive Intelligence    | Step 3 & 4 in Walkthrough HUD     | 20s Lookahead & Queue balancing
| 01:45-02:15 | Runtime Incident & Exit Failure    | Step 5: Toggle Exit Block         | Zero trapping & panic hysteresis
| 02:15-02:45 | Evidence Lab & Statistical Rigor   | Step 6 -> Evidence Dashboard      | 20 paired seeds, p=0.0001, CI
| 02:45-03:00 | Conclusion & Safety Boundaries     | Summary Card / Architecture       | Research twin disclaimer & impact
+--------------------------------------------------------------------------------------------------------+
```

### [00:00 - 00:30] Problem Hook & Mission
- **Screen Action:** Open `http://localhost:5173`. Click the top-bar button: `Interactive Walkthrough` (or launch Step 1 in the Demonstration Mode HUD).
- **Spoken Script:**
  > "Distinguished judges, when a fire alarm sounds today, almost every commercial building directs occupants using static green exit signs to the geographically closest door. 
  > 
  > But human crowd physics doesn't work in isolation: when hundreds of people rush to the same doorway, corridor density spikes, walking speeds collapse under Weidmann crowd deceleration, and fatal crushing bottlenecks form while nearby exits sit completely empty.
  > 
  > This is **EXIT-ZERO** — an adaptive digital twin that acts like Google Maps for building emergencies, balancing crowd flows dynamically before lethal bottlenecks can form."

---

### [00:30 - 01:00] The Baseline Failure (Conventional Shortest Path)
- **Screen Action:** In the floating HUD, advance to **Step 2** and click **"Load & Run Baseline"**. The simulation resets to Seed 101, Baseline, 200 occupants, and begins playback at 1x speed.
- **Spoken Script:**
  > "Let's watch the industry standard: static shortest-path Dijkstra routing. Here in our corporate headquarters model with 200 occupants, watch what happens in the central corridor.
  > 
  > Because the North Main Portal is geographically closest to the atrium and executive suites, over 120 people blindly surge toward it. Within 15 seconds, crowd density exceeds 3.2 persons per square meter — represented by the glowing crimson halo on our floor plan. People decelerate to a crawl, and an immense queue of 36 people backs up into the hallway while the West Ramp and East Fire Door are virtually abandoned."

---

### [01:00 - 01:45] EXIT-ZERO Adaptive Predictive Intelligence
- **Screen Action:** In the HUD, click **Step 4: Predictive Adaptive Routing** and click **"Run EXIT-ZERO Adaptive Simulation"**. The simulation resets with the exact same seed (101) under the Adaptive algorithm and starts playing.
- **Spoken Script:**
  > "Now, watch the exact same building, the exact same occupants, and the exact same seed under EXIT-ZERO.
  > 
  > Notice the difference immediately! Instead of greedily choosing the closest door, EXIT-ZERO evaluates a multi-objective cost function with a 20-second predictive lookahead horizon. It estimates upcoming queue arrival times and proactively diverts occupants from the central hallway into the West Ramp and East Fire Door *before* queues can form.
  > 
  > Notice also our mobility-aware constraint: wheelchair users (amber circles) are strictly routed through ADA-accessible ramps and corridors and stabilized against unnecessary long detours, while standard walkers disperse evenly across all open exits."

---

### [01:45 - 02:15] Runtime Incident Resilience & Exit Blockage
- **Screen Action:** At `t ≈ 18s`, in the HUD, advance to **Step 5** and click **"⚡ Block East Fire Escape"** (or click the door node directly on the canvas).
- **Spoken Script:**
  > "Real emergencies are dynamic. At simulated time 18 seconds, a ceiling beam collapses and completely blocks the East Fire Escape.
  > 
  > Watch the floor plan: instantly, the digital twin detects the blocked portal, invalidates the graph cache, and issues an emergency reroute override. Occupants heading east smoothly pivot toward the North and West exits without hesitation.
  > 
  > Because our algorithm incorporates a 20% hysteresis threshold and reroute penalties, occupants do not suffer from chaotic decision chatter or oscillation. Zero occupants are trapped, and zero occupants are left behind."

---

### [02:15 - 02:45] Reproducible Evidence & Statistical Validation
- **Screen Action:** Click **Step 6** in HUD, then click **"Open Evidence Dashboard"** (or click the `Evidence Lab` tab in the top navigation).
- **Spoken Script:**
  > "We do not rely on single-run anecdotes. In our Reproducible Evidence Lab, we benchmarked Baseline versus EXIT-ZERO across 20 strictly paired random seeds with identical initial spawn coordinates and movement physics.
  > 
  > In Scenario B (`N=200`, 20 paired seeds):
  > - EXIT-ZERO achieves a statistically significant **+13.65% evacuation speedup** (`84.45s` Baseline -> `72.92s` Adaptive, $p = 0.0001$, saving **11.53 seconds** on average).
  > - The 95% bootstrap confidence interval spans **[6.50s, 16.60s]**, strictly above zero.
  > - Peak exit bottleneck queues are reduced by an average of **7.30 occupants**.
  > - In head-to-head trials, EXIT-ZERO won **16 seeds, tied 1, and lost only 3**.
  > - Python heap (`tracemalloc`) and process RSS (`psutil`) are reported separately for strict honesty."

---

### [02:45 - 03:00] Conclusion, Safety Disclaimer & Future Vision
- **Screen Action:** Switch back to the Floor Plan View, showing the green completion state.
- **Spoken Script:**
  > "To conclude: EXIT-ZERO is an academic research digital twin, not a certified life-safety control system. But it demonstrates conclusively that predictive, congestion-aware digital twin intelligence can transform emergency evacuation from a chaotic crush into an optimized, life-saving egress.
  > 
  > Thank you, and we welcome your questions!"

---

## 3. Preparation Checklist Before Judging

1. **Host Environment:**
   - Operating System: Windows 11 / 64-bit.
   - Python: 3.14.7 virtual environment (`backend/.venv`).
   - Node.js: v24.19.0.
2. **Backend Daemon Verification:**
   - Open PowerShell:
     ```powershell
     cd "C:\Users\PRAVEENRAJ\Desktop\Exit zero\backend"
     .\.venv\Scripts\uvicorn app.main:app --port 8000
     ```
   - Verify health: `curl http://localhost:8000/api/health` returns `{"status":"ok", ...}`.
3. **Frontend Server Verification:**
   - Open second PowerShell:
     ```powershell
     cd "C:\Users\PRAVEENRAJ\Desktop\Exit zero\frontend"
     npm run dev
     ```
   - Open browser at `http://localhost:5173`.
4. **Display & Browser Settings:**
   - Browser: Google Chrome or Microsoft Edge.
   - Screen resolution: 1920x1080 (100% DPI scaling recommended).
   - Zoom level: 100%.
   - Fullscreen mode: Press `F11` for a clean presentation view.

---

## 4. Backup & Contingency Procedure

If an unexpected local network or port collision occurs during presentation:
1. **Fallback 1 (Pre-built Artifacts):**
   The Evidence Lab automatically loads the verified Scenario B benchmark artifact (`experiments/benchmark_scenario_congested_corridor_N200_20seeds.json` via `/api/experiments/saved/scenario_congested_corridor`), rendering interactive statistical charts and working CSV/JSON exports immediately.
2. **Fallback 2 (Pre-rendered Evidence Summary):**
   Open `docs/final_evidence_summary.md` and `docs/phase5_2_final_validation.md` for formatted tables, CI intervals, and visual ASCII architecture diagrams.
3. **Fallback 3 (Quick Daemon Restart):**
   Run the one-line recovery script in PowerShell:
   ```powershell
   Get-Process python, node -ErrorAction SilentlyContinue | Stop-Process -Force
   Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\PRAVEENRAJ\Desktop\Exit zero\backend'; .\.venv\Scripts\uvicorn app.main:app --port 8000"
   Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\PRAVEENRAJ\Desktop\Exit zero\frontend'; npm run dev"
   ```

---

## 5. Top 5 Likely Judge Questions & Technical Answers

### Q1: How does EXIT-ZERO prevent occupants from herding or oscillating to the newly open exit?
> **Answer:** "We prevent herd oscillation through two mathematical mechanisms:
> 1. **Predictive Arrival Horizon ($T_{\text{horizon}} = 20\text{s}$):** When an occupant evaluates a secondary exit, the algorithm calculates how many *other* occupants are already projected to reach that exit within their arrival window. The candidate cost penalizes upcoming arrival queues, preventing simultaneous over-subscription.
> 2. **Hysteresis Threshold ($\theta_{\text{hyst}} = 0.20$) & Switching Penalty ($w_{\text{reroute}} = 5.0\text{s}$):** An occupant will not switch exits for a marginal improvement. The alternative route must yield at least a 20% total cost advantage over the current plan."

### Q2: Why are baseline evacuees not allowed to change routes when an exit is congested?
> **Answer:** "This is a deliberate and rigorous design for fair comparison. In real commercial buildings without smart dynamic signage, people follow the physical exit signs pointing to their nearest egress door. If we gave the baseline arbitrary heuristics, it would no longer represent standard architectural building code egress. However, for baseline fairness, if an exit is *physically blocked* by a fire or barrier, baseline occupants *do* safely recompute a new shortest path to the next nearest open exit."

### Q3: How do you achieve sub-second execution on 500 agents without dropping frame rates?
> **Answer:** "We eliminated the traditional $O(N^2)$ agent-agent distance loops:
> 1. We precompute arrival schedules per exit in a single $O(N)$ pass each replan cycle.
> 2. We use single-source Dijkstra from each occupant's current node to all exits in a single graph search ($O(E + V \log V)$) rather than running $K$ separate Dijkstra calls.
> 3. We maintain cached subgraphs for Standard and Wheelchair mobility classes that are invalidated only on actual topological changes (exit blockage or fire engulfment). This gave us a 10.1x speedup."

### Q4: Is EXIT-ZERO compliant with NFPA 101 or certified as a life-safety egress system?
> **Answer:** "No. We explicitly state in our documentation, user interface, and reports that EXIT-ZERO is an academic research prototype and digital twin simulation, not a certified life-safety device under NFPA 101 or EN 54. Its purpose is to assist architects, fire safety engineers, and building operators in testing dynamic routing policies and identifying bottleneck hazards before construction."

### Q5: How do you handle accessibility and wheelchair users in mixed-mobility buildings?
> **Answer:** "Wheelchair occupants have strict mobility constraints: their traversable graph filters out all stairways, escalators, and non-ADA doorways. Furthermore, because wheelchair users have a lower top speed (0.65–0.85 m/s vs 1.20–1.45 m/s), distance is physically more expensive for them than moderate exit queues. Our routing objective stabilizes wheelchair routes against needless long detours (`total_cost -= queue_diff * 0.5`) while keeping `w_accessibility_reservation` configurable (`0.0` default) so narrow emergency stairwells are not artificially overloaded."
