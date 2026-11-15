from fastapi.testclient import TestClient

from senda.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_targets_from_json():
    res = client.get("/api/v1/targets")
    assert res.status_code == 200
    assert len(res.json()) == 8


def test_target_not_found():
    assert client.get("/api/v1/targets/NOPE").status_code == 404


def test_environment():
    assert client.get("/api/v1/environment").json()["sol"] == 5074


def test_routes_eva_three_profiles():
    res = client.post("/api/v1/routes", json={"target_ids": ["T02", "T05"]})
    assert res.status_code == 200
    body = res.json()
    assert {r["profile"] for r in body["routes"]} == {"safe", "fast", "scientific"}
    r = body["routes"][0]
    assert len(r["path"]) == len(r["cells"]) and r["path"][0][0] > 137
    assert r["segments"][0]["from"] == "T01" and r["stops"]


def test_routes_unknown_target():
    assert client.post("/api/v1/routes", json={"target_ids": ["NOPE"]}).status_code == 404


def test_mission_plan_shape():
    res = client.post("/api/v1/mission/plan", json={"target_ids": ["T02", "T06"], "profiles": ["safe"]})
    assert res.status_code == 200
    body = res.json()
    for key in ("base", "staging", "traverse_out", "eva", "traverse_back", "timeline", "assumptions"):
        assert key in body
    assert body["staging"]["target_id"] == "T01"
    assert any(a["activity"] == "eva" for a in body["timeline"])
    assert body["traverse_out"]["metrics"]["energy_kWh"] > 0


def test_simulate_sep_diverts():
    route = client.post("/api/v1/routes", json={"target_ids": ["T02"], "profiles": ["safe"]}).json()["routes"][0]
    res = client.post("/api/v1/simulate", json={"route": route, "scenario": "sep_event", "scenario_at_index": 50})
    assert res.status_code == 200
    body = res.json()
    assert any(r["alert"] and r["alert"]["code"] == "SEP_EVENT" for r in body["timeline"])
    assert body["diversion"] is not None


def test_simulate_rejects_bad_route():
    res = client.post("/api/v1/simulate", json={"route": {"cells": [[0, 0], [5, 5]]}})
    assert res.status_code == 422


def test_return_field_and_png():
    meta = client.get("/api/v1/return-field?leg=eva").json()
    assert meta["unit"] == "L O2" and meta["max_value"] > 0
    png = client.get(meta["png_url"])
    assert png.status_code == 200 and png.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_scenarios():
    ids = {s["id"] for s in client.get("/api/v1/scenarios").json()}
    assert {"none", "sep_event", "suit_leak", "blocked_path"} <= ids
