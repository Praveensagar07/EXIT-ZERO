import os
import threading
import uuid
from typing import Dict, List, Optional

from app.experiments.exporter import export_to_csv, export_to_json
from app.experiments.models import (
    ExperimentJobStatus,
    ExperimentResult,
    ExperimentRunRequest,
)
from app.experiments.runner import run_experiment


class ExperimentJobManager:
    """
    Manages asynchronous background execution of multi-seed simulation benchmarks,
    supporting real-time progress polling, thread-safe status updates, and auto-export.
    """

    def __init__(self, export_dir: str = "experiments"):
        self.jobs: Dict[str, ExperimentJobStatus] = {}
        self.lock = threading.Lock()
        self.export_dir = export_dir
        os.makedirs(self.export_dir, exist_ok=True)

    def create_job(self, request: ExperimentRunRequest) -> str:
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        total_trials = len(request.seeds)

        status_obj = ExperimentJobStatus(
            job_id=job_id,
            status="pending",
            progress_pct=0.0,
            completed_trials=0,
            total_trials=total_trials,
            scenario_id=request.scenario_id,
            occupant_count=request.occupant_count,
        )

        with self.lock:
            self.jobs[job_id] = status_obj

        # Spawn worker thread
        thread = threading.Thread(
            target=self._run_job_worker,
            args=(job_id, request),
            daemon=True,
        )
        thread.start()

        return job_id

    def _run_job_worker(self, job_id: str, request: ExperimentRunRequest):
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].status = "running"

        def on_progress(completed: int, total: int):
            with self.lock:
                if job_id in self.jobs:
                    self.jobs[job_id].completed_trials = completed
                    self.jobs[job_id].progress_pct = round((completed / max(1, total)) * 100.0, 1)

        try:
            result = run_experiment(request, progress_callback=on_progress)

            # Persist exports to disk
            export_to_csv(result, save_dir=self.export_dir)
            export_to_json(result, save_dir=self.export_dir)

            with self.lock:
                if job_id in self.jobs:
                    self.jobs[job_id].status = "completed"
                    self.jobs[job_id].progress_pct = 100.0
                    self.jobs[job_id].completed_trials = len(request.seeds)
                    self.jobs[job_id].result = result

        except Exception as exc:
            with self.lock:
                if job_id in self.jobs:
                    self.jobs[job_id].status = "failed"
                    self.jobs[job_id].error = str(exc)

    def get_job(self, job_id: str) -> Optional[ExperimentJobStatus]:
        with self.lock:
            return self.jobs.get(job_id)

    def list_jobs(self) -> List[ExperimentJobStatus]:
        with self.lock:
            return list(self.jobs.values())


# Singleton manager instance
job_manager = ExperimentJobManager()
