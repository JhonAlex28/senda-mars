"""Integration test for the optional IBM Quantum / Qiskit QAOA route optimizer endpoint."""
from __future__ import annotations

from fastapi.testclient import TestClient

from senda.main import app


def test_quantum_optimize_route_aer_or_fallback() -> None:
    client = TestClient(app)
    resp = client.post(
        "/api/v1/quantum/optimize-route",
        json={
            "base": {"lon": 137.42009295, "lat": -4.59310427},
            "selected_goal_ids": [],
            "speed_kmh": 8.0,
            "qpu_backend": "aer_simulator",
            "layers": 2,
            "shots": 256,
            "noise_profile": "ideal",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "ibm-quantum-runtime"
    assert data["nQubits"] >= 2
    assert len(data["recommendedTargetIds"]) >= 1
    assert data["bestBitstring"].startswith("|")
