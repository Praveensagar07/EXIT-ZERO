import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "capabilities" in data


def test_get_scenarios():
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 2
    scenario_ids = [s["id"] for s in scenarios]
    assert "scenario_hq_floor1" in scenario_ids


def test_get_scenario_detail():
    res = client.get("/api/scenarios/scenario_hq_floor1")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "scenario_hq_floor1"
    assert len(data["building"]["floors"]) > 0
    assert len(data["hazard_sources"]) > 0


def test_validate_scenario_topology():
    res = client.post("/api/scenarios/validate", json={"scenario_id": "scenario_hq_floor1"})
    assert res.status_code == 200
    data = res.json()
    assert data["audit"]["is_valid"] is True
    assert data["audit"]["total_exits"] == 4


def test_simulation_lifecycle_and_determinism():
    # Initialize Simulation 1 with seed 42
    payload1 = {
        "scenario_id": "scenario_hq_floor1",
        "algorithm": "baseline",
        "seed": 42,
        "occupant_count_override": 50,
    }
    res1 = client.post("/api/simulation/init", json=payload1)
    assert res1.status_code == 200
    state1 = res1.json()
    session_id1 = state1["session_id"]
    assert len(state1["occupants"]) == 50

    # Initialize Simulation 2 with identical seed 42
    res2 = client.post("/api/simulation/init", json=payload1)
    assert res2.status_code == 200
    state2 = res2.json()

    # Determinism Check: Exact coordinates and speeds match
    for o1, o2 in zip(state1["occupants"], state2["occupants"]):
        assert o1["x"] == o2["x"]
        assert o1["y"] == o2["y"]
        assert o1["free_speed"] == o2["free_speed"]
        assert o1["current_path"] == o2["current_path"]

    # Step simulation
    step_res = client.post(
        f"/api/simulation/{session_id1}/step",
        json={"steps": 5, "dt": 0.5},
    )
    assert step_res.status_code == 200
    stepped_state = step_res.json()
    assert stepped_state["current_time_sec"] == 2.5
    assert stepped_state["step_count"] == 5

    # Get state
    get_res = client.get(f"/api/simulation/{session_id1}/state")
    assert get_res.status_code == 200
    assert get_res.json()["current_time_sec"] == 2.5

    # Reset
    reset_res = client.post(f"/api/simulation/{session_id1}/reset")
    assert reset_res.status_code == 200
    reset_state = reset_res.json()
    assert reset_state["current_time_sec"] == 0.0
    assert reset_state["step_count"] == 0


def test_experiments_api_lifecycle():
    # 1. Invalid scenario test
    invalid_res = client.post("/api/experiments/run", json={"scenario_id": "non_existent_scenario", "seeds": [1]})
    assert invalid_res.status_code == 404

    # 2. Trigger valid batch experiment
    req_payload = {
        "scenario_id": "scenario_normal_evacuation",
        "occupant_count": 30,
        "seeds": [301, 302],
        "max_sim_time_sec": 30.0,
    }
    trigger_res = client.post("/api/experiments/run", json=req_payload)
    assert trigger_res.status_code == 200
    job_id = trigger_res.json()["job_id"]
    assert job_id.startswith("job_")

    # 3. Poll status until completed
    import time
    for _ in range(50):
        status_res = client.get(f"/api/experiments/{job_id}/status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        if status_data["status"] in ["completed", "failed"]:
            break
        time.sleep(0.1)

    assert status_data["status"] == "completed"
    assert status_data["progress_pct"] == 100.0

    # 4. Fetch results
    results_res = client.get(f"/api/experiments/{job_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert len(results_data["trials"]) == 2
    assert "summary" in results_data

    # 5. Export CSV
    csv_res = client.get(f"/api/experiments/{job_id}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "SUMMARY_STATISTICS" in csv_res.text

    # 6. Export JSON
    json_res = client.get(f"/api/experiments/{job_id}/export/json")
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers.get("content-type", "")

    # 7. List history
    history_res = client.get("/api/experiments/history")
    assert history_res.status_code == 200
    assert any(j["job_id"] == job_id for j in history_res.json())


def test_saved_experiment_and_exports():
    saved_res = client.get("/api/experiments/saved/scenario_congested_corridor")
    assert saved_res.status_code == 200
    saved = saved_res.json()
    assert saved["job_id"] == "exp_4049e56e"
    assert saved["summary"]["sample_size"] == 20
    assert saved["summary"]["baseline_mean_time_sec"] == 84.45
    assert saved["summary"]["adaptive_mean_time_sec"] == 72.92

    csv_res = client.get(f"/api/experiments/{saved['job_id']}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "SUMMARY_STATISTICS" in csv_res.text

    json_res = client.get(f"/api/experiments/{saved['job_id']}/export/json")
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers.get("content-type", "")
    assert "exp_4049e56e" in json_res.text

    missing_res = client.get("/api/experiments/saved/non_existent_scenario")
    assert missing_res.status_code == 404


