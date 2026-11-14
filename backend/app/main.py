import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import router

app = FastAPI(
    title="EXIT-ZERO Emergency Evacuation Digital Twin API",
    description="Adaptive multi-agent evacuation simulation research engine for INNOVEX 2026",
    version="0.1.0",
)

# Local development is same-origin through Vite's proxy. Separate frontend and
# backend deployments can provide a comma-separated allowlist.
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "EXIT_ZERO_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "Welcome to EXIT-ZERO Digital Twin API. Access docs at /docs or health at /api/health",
        "project": "EXIT-ZERO",
        "event": "INNOVEX 2026",
    }
