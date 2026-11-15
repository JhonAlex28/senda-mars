"""Endpoint opcional de optimización cuántica: la respuesta dice con honestidad qué se ejecutó."""
from __future__ import annotations

import importlib.util

from fastapi.testclient import TestClient

from senda.main import app

BODY = {"base": {"lon": 137.42009295, "lat": -4.59310427}, "selected_goal_ids": [],
        "speed_kmh": 8.0, "qpu_backend": "aer_simulator", "layers": 2, "shots": 256,
        "noise_profile": "ideal"}


def test_quantum_optimize_reports_what_actually_ran() -> None:
    resp = TestClient(app).post("/api/v1/quantum/optimize-route", json=BODY)
    assert resp.status_code == 200
    data = resp.json()
    expected = "qiskit-aer" if importlib.util.find_spec("qiskit_aer") else "classical-fallback"
    assert data["mode"] == expected
    assert data["fidelityPct"] is None and data["limitations"]
    assert data["nQubits"] >= 2 and len(data["recommendedTargetIds"]) >= 1
    assert data["bestBitstring"].startswith("|")
    assert data["gateSummary"]["rzzGates"] == (data["nQubits"] - 1) * data["layers"]


def test_ibm_token_is_not_accepted_from_the_client() -> None:
    resp = TestClient(app).post("/api/v1/quantum/optimize-route",
                                json={**BODY, "ibm_token": "secret"})
    assert resp.status_code == 200   # el campo se ignora: el token solo vive en el servidor
    assert resp.json()["mode"] != "ibm-qpu"
