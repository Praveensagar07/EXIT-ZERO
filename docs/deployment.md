# EXIT-ZERO Deployment Guide

This guide prepares a production-style hackathon deployment. No public deployment URL is claimed in this repository.

## Recommended topology

Prefer one public origin:

```text
Browser → static React build
        → /api/* reverse proxy → FastAPI process
```

The same-origin layout avoids cross-origin complexity and keeps the frontend API path at its default `/api`.

## Backend

Install from `backend/requirements.txt`, set `PYTHONPATH=backend`, and start:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For a managed process, configure the equivalent command from the repository root:

```text
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port <platform-port>
```

Health check: `GET /api/health`.

The experiment job manager is in-process and stores job state in memory. A process restart loses active job status, although completed CSV/JSON files already written to durable storage remain usable. Use a single backend worker for the hackathon demo unless job state is moved to shared storage.

## Frontend

```powershell
cd frontend
npm ci
npm run build
```

Publish `frontend/dist` as a static site. Configure the host to return `index.html` for application routes.

If the API is on a different origin, set this at build time:

```text
VITE_API_BASE=https://api.example.invalid/api
```

Replace the example value with the real backend URL. Do not publish the placeholder.

On the backend, allow the deployed frontend origin:

```text
EXIT_ZERO_CORS_ORIGINS=https://frontend.example.invalid
```

For multiple known origins, use a comma-separated list. Wildcard credentialed CORS is intentionally not enabled.

## Persistence

The `experiments/` directory must be writable if the deployed demo will export experiment artifacts. On ephemeral hosts, mount durable storage or download results before restarting the service.

## Pre-deployment checklist

1. Run the full backend test suite.
2. Run frontend lint and production build.
3. Start both services and confirm `/api/health`.
4. Load Scenario B and run at least one short baseline/adaptive pair.
5. Confirm experiment progress polling and CSV/JSON downloads.
6. Verify keyboard focus, modal Escape handling, and a 390 px-wide layout.
7. Confirm the research-prototype disclaimer is visible in the Evidence Lab and submission copy.
8. Record the deployed commit or archive checksum and the deployment time.

## Rollback

Retain the previous built frontend directory and backend release. If health checks, simulation initialization, or evidence export fails, restore the previous pair together; frontend and backend types evolve in tandem.

