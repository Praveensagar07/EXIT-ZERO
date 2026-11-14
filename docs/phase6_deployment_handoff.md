# EXIT-ZERO — Phase 6 Deployment Handoff & Operations Manual

**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Hackathon:** INNOVEX 2026 (Submission Deadline: November 15, 2026)  
**Handoff Date:** November 14, 2026  
**Release Candidate Identifier:** `EXIT-ZERO-v1.0.0-rc1`  
**Target Environment:** Local Bare-Metal, Docker Container, or Cloud PaaS (e.g., Railway / Render / DigitalOcean)

---

## 1. Verified Local Startup Protocol

### Backend Daemon (FastAPI / Uvicorn):
Open a terminal in the project root:
```powershell
# 1. Activate virtual environment and set Python path
$env:PYTHONPATH = "backend"

# 2. Launch single-worker Uvicorn process (bind to port 8000)
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- Health Check: `curl http://127.0.0.1:8000/api/health`
- Expected Output: `{"status":"ok","version":"0.1.0","service":"EXIT-ZERO Emergency Evacuation Digital Twin Engine",...}`

### Frontend Server (React 19 / Vite):
Open a second terminal in the project root:
```powershell
# Launch Vite dev server with reverse proxy (/api -> http://localhost:8000)
npm run dev --prefix frontend
```
- Local URL: `http://localhost:5173`
- The Vite dev server proxies all `/api/*` traffic to the backend seamlessly.

---

## 2. Production Build & Serving Options

### Option A: Static Frontend Build + FastAPI Static Mount (Single Process)
1. Build frontend distribution bundle:
   ```powershell
   npm run build --prefix frontend
   ```
2. The production assets are output to `frontend/dist/`.
3. In a unified deployment, FastAPI can mount `frontend/dist` via `StaticFiles(directory="frontend/dist", html=True)`.

### Option B: Decoupled Cloud Deployment (e.g., Railway, Vercel + Container)
- **Backend Service:**
  - Environment Variables:
    - `PYTHONPATH`: `backend`
    - `PORT`: `8000` (or platform `$PORT`)
    - `EXIT_ZERO_CORS_ORIGINS`: Comma-separated list of allowed origins, e.g. `https://your-frontend-domain.com,http://localhost:5173`
  - Start Command:
    ```bash
    python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
    ```
  - **CRITICAL:** Do NOT set `--workers > 1`. The in-process experiment job manager requires a single process.
  - **Storage:** If persistent benchmark exports must survive container restarts, mount a persistent volume at `/app/experiments`.

- **Frontend Service:**
  - Environment Variables:
    - `VITE_API_BASE`: `https://your-backend-domain.com/api` (or empty if using a reverse proxy)
  - Build Command: `npm ci && npm run build`
  - Output Directory: `dist`

---

## 3. Post-Deployment Smoke Verification Protocol

Immediately after deployment, execute the following smoke verification sequence:

1. **API Health Check:**
   ```bash
   curl -I https://<DEPLOYED_BACKEND>/api/health
   # Verify HTTP 200 OK and "status": "ok"
   ```
2. **Scenario List Retrieval:**
   ```bash
   curl https://<DEPLOYED_BACKEND>/api/scenarios
   # Verify 8 scenarios returned as JSON array
   ```
3. **Simulation Session Lifecycle:**
   ```bash
   # Initialize simulation
   curl -X POST -H "Content-Type: application/json" \
     -d '{"scenario_id":"scenario_congested_corridor","algorithm":"adaptive","seed":101}' \
     https://<DEPLOYED_BACKEND>/api/simulation/init
   ```
4. **Saved Benchmark Artifact Access:**
   ```bash
   curl https://<DEPLOYED_BACKEND>/api/experiments/saved/scenario_congested_corridor
   # Verify 20-seed summary loads with 84.45s baseline and 72.92s adaptive
   ```
5. **Browser Walkthrough Smoke Check:**
   - Open browser at deployed frontend URL.
   - Verify floor plan renders without console errors.
   - Click "Interactive Demo" button and advance through Step 1 to Step 6.
   - Verify CSV export downloads correctly.

---

## 4. Emergency Contingency Plan for Live Judging

If internet access is degraded or public cloud URLs encounter DNS delays during the 3-minute hackathon presentation:
- **Local Fallback:** Run the pre-verified local stack (`http://localhost:5173` + `http://127.0.0.1:8000`). It operates with zero external internet dependencies.
- **Offline Artifacts:** All 20-seed paired experimental benchmarks are pre-rendered into `experiments/*.json` and `experiments/*.csv`.
- **Pre-rendered Screenshots:** High-resolution screenshots of all 6 walkthrough steps and 4 responsive viewports are stored in `docs/evidence_screenshots/`.
