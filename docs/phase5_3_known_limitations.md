# EXIT-ZERO — Phase 5.3 Known Limitations & Research Boundaries

**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Hackathon:** INNOVEX 2026  
**Auditor:** Simulation Reliability Specialist & Hackathon Judge  
**Release Candidate:** `EXIT-ZERO-v1.0.0-rc1`  

---

## 1. Life-Safety & Regulatory Disclaimer

> [!WARNING]
> **EXIT-ZERO IS AN ACADEMIC RESEARCH DIGITAL TWIN AND ALGORITHM PROTOTYPE.**
>
> EXIT-ZERO is **not** certified under NFPA 101 (Life Safety Code), NFPA 72 (National Fire Alarm and Signaling Code), EN 54, ISO 21542, or any municipal building safety regulations. It must never be connected to real-world emergency door controls, public address systems, or life-safety hardware in actual buildings.

The software is engineered to explore dynamic multi-agent queue-balancing, Weidmann crowd deceleration physics, and accessibility constraints in simulated architectural graphs.

---

## 2. Simulation & Modeling Assumptions

1. **Macroscopic & Mesoscopic Hybrid Model:**
   - Occupant speeds follow continuous Weidmann speed-density deceleration $v(\rho) = v_0 \cdot \max(0.1, 1 - \exp(-\gamma (\rho_{\max} - \rho)))$ on 1D graph edges and 2D waypoints.
   - The simulation does not compute 3D body contact forces, crowd crush asphyxiation, turbulence waves, or multi-body ragdoll physics.
2. **Simplified Hazard Dispersion:**
   - Environmental hazards (fire and smoke) are modeled as radial dispersion zones with linear growth rates and corridor intersection checks.
   - The engine does not perform Computational Fluid Dynamics (CFD), Navier-Stokes smoke transport, buoyant plume buoyancy, or toxic gas species concentration analysis.
3. **Behavioral Compliance:**
   - Simulated occupants are assumed to comply with dynamic route assignments when given. In real-world crises, human panic, social affiliation, herding, and exit familiarity can induce non-compliant movement.

---

## 3. Architecture & Infrastructure Limitations

1. **Single-Worker Requirement for In-Process Job Manager:**
   - `app.experiments.job_manager.JobManager` maintains background thread execution and job status in memory (`self._jobs: Dict[str, ExperimentJobStatus]`).
   - If the FastAPI backend is launched with multiple worker processes (`uvicorn --workers > 1`), status polling and result retrieval will fail intermittently due to cross-process memory isolation.
   - **Requirement:** Deploy with a single worker process (`--workers 1`), or integrate Redis / Celery in future releases.
2. **Ephemeral Hosting Filesystem Storage:**
   - Persistent experiment artifacts (CSV and JSON) are saved to the `experiments/` directory on local disk.
   - On ephemeral serverless or container platforms (e.g., standard container dynos or serverless functions), local disk writes are lost upon container recreation.
   - **Requirement:** For production hosting, mount a persistent volume (e.g., Railway Volume, Docker volume) or connect an external object store (e.g., Supabase Storage / S3).
3. **In-Memory Active Simulation Sessions:**
   - Live interactive simulation sessions (`active_sessions: Dict[str, SimulationEngine]`) reside in backend process memory. A process restart resets active sessions to initial state.

---

## 4. Statistical Evidence Boundaries

1. **No Universal Guarantee of Superiority:**
   - EXIT-ZERO does **not** claim to outperform baseline shortest-path evacuation in every possible building geometry or population density.
   - In uncrowded buildings ($N < 50$), shortest path is already optimal, and adaptive routing yields parity ($0\text{s}$ difference).
   - If secondary exits require extreme detour distances, travel time penalties may outweigh queue wait savings.
2. **Mixed-Mobility Bottleneck Dynamics:**
   - In buildings where wheelchair users already have an uncongested ground-floor ramp, over-penalizing ambulatory occupants away from that ramp forces them into narrow emergency stairwells, increasing overall clearance time slightly. Setting `w_accessibility_reservation = 0.0` prevents this stair bottleneck.
3. **Preliminary Tier on Extreme Scale ($N=500$):**
   - The 500-occupant trial in `experiments/benchmark_scenario_congested_corridor_N500_3seeds.json` utilized only 3 seeds ($p = 0.25$). It is explicitly classified as **preliminary evidence** and should not be presented as statistically conclusive.
