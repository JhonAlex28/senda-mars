from fastapi.testclient import TestClient

from senda.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_targets_from_json():
    res = client.get("/api/v1/targets")
    assert res.status_code == 200
    targets = res.json()
    assert len(targets) == 16   # targets_v1: base B00 + 15 objetivos reales de Curiosity
    assert sum(t["is_base"] for t in targets) == 1
    assert targets[1]["task"]["duration_min"] > 0


def test_target_not_found():
    assert client.get("/api/v1/targets/NOPE").status_code == 404


def test_environment():
    assert client.get("/api/v1/environment").json()["sol"] == 5074


def test_readiness():
    body = client.get("/api/v1/environment/readiness").json()
    assert body["verdict"] == "go"
    assert {c["key"] for c in body["checks"]} == {"temperature", "wind", "dust", "radiation"}


def test_terrain_grid():
    body = client.get("/api/v1/terrain", params={"cell_size_m": 40}).json()
    assert len(body["elevation_m"]) == len(body["slope_deg"]) == body["rows"] * body["cols"]


BASE = {"lon": 137.396, "lat": -4.785}


def test_traverse_proposes_parkings_and_three_routes():
    res = client.post("/api/v1/routes/traverse", json={"base": BASE, "target_ids": ["T05", "T02"]})
    assert res.status_code == 200
    body = res.json()
    assert body["parkings"] and {r["profile"] for r in body["routes"]} == {"safe", "scientific", "fast"}
    route = body["routes"][0]
    assert route["mode"] == "rover" and route["resource"]["name"] == "battery"
    assert route["stops"][-1]["kind"] == "base"


def test_eva_visits_targets_and_returns_to_rover():
    parking = client.post("/api/v1/routes/traverse",
                          json={"base": BASE, "target_ids": ["T05", "T07"]}).json()["parkings"][0]
    rover = {"lon": parking["lon"], "lat": parking["lat"]}
    routes = client.post("/api/v1/routes/eva", json={"rover": rover, "target_ids": parking["target_ids"]}).json()
    stops = [s["ref_id"] for s in routes[0]["stops"]]
    assert stops == ["T05", "T07", "rover"]
    assert routes[0]["resource"]["name"] == "oxygen"


def test_path_replans_with_hazard():
    body = {
        "mode": "rover",
        "waypoints": [{**BASE, "kind": "base"}, {"lon": 137.385, "lat": -4.80, "kind": "waypoint"}],
        "hazards": [{"lon": 137.39, "lat": -4.792, "radius_m": 80}],
        "profiles": ["safe"],
    }
    routes = client.post("/api/v1/routes/path", json=body).json()
    assert len(routes) == 1 and routes[0]["profile"] == "safe"


def test_unknown_target_is_404():
    res = client.post("/api/v1/routes/traverse", json={"base": BASE, "target_ids": ["NOPE"]})
    assert res.status_code == 404


def test_base_outside_site_is_422():
    res = client.post("/api/v1/routes/traverse",
                      json={"base": {"lon": 0, "lat": 0}, "target_ids": ["T05"]})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Motor de Mec. B: contrato extendido y endpoints adicionales
# ---------------------------------------------------------------------------
CALEF_BASE = {"lon": 137.42009295, "lat": -4.59310427}


def test_traverse_from_calef_base_reaches_boxwork():
    res = client.post("/api/v1/routes/traverse", json={"base": CALEF_BASE, "target_ids": ["T02", "T05", "T06"]})
    assert res.status_code == 200, res.text
    body = res.json()
    route = next(r for r in body["routes"] if r["profile"] == "safe")
    assert route["distance_m"] > 20_000          # ida y vuelta de ~12 km
    assert route["resource"]["unit"] == "kWh" and route["return_ok"]
    assert "reserve_min" in route and "pnr_index" in route


def test_eva_routes_report_pnr_and_reserve():
    parking = client.post("/api/v1/routes/traverse",
                          json={"base": BASE, "target_ids": ["T05", "T06"]}).json()["parkings"][0]
    routes = client.post("/api/v1/routes/eva", json={"rover": {"lon": parking["lon"], "lat": parking["lat"]},
                                                      "target_ids": parking["target_ids"]}).json()
    assert {r["profile"] for r in routes} == {"safe", "scientific", "fast"}
    for r in routes:
        assert r["resource"]["unit"] == "L" and r["pnr_index"] is None and r["reserve_min"] > 0
        assert r["points"][-1]["resource_used"] <= r["resource"]["used"]


def test_eva_suit_leak_uses_more_oxygen():
    rover = {"lon": 137.3815, "lat": -4.8065}
    nominal = client.post("/api/v1/routes/eva", json={"rover": rover, "target_ids": ["T05"]}).json()[0]
    leak = client.post("/api/v1/routes/eva", json={"rover": rover, "target_ids": ["T05"],
                                                   "conditions": {"o2_multiplier": 1.5}}).json()[0]
    assert leak["resource"]["used"] > nominal["resource"]["used"] * 1.4


def test_terrain_reports_scale():
    body = client.get("/api/v1/terrain", params={"cell_size_m": 40}).json()
    assert body["scale"] == "regional"
    assert body["bbox"]["max_lat"] > -4.6          # el área de misión incluye la base Calef


def test_mission_plan_shape():
    res = client.post("/api/v1/mission/plan", json={"target_ids": ["T02", "T06"], "profiles": ["safe"]})
    assert res.status_code == 200
    body = res.json()
    for key in ("base", "staging", "traverse_out", "eva", "traverse_back", "timeline", "assumptions"):
        assert key in body
    assert body["staging"]["target_id"].startswith("P")   # estacionamiento propuesto (R-4)
    assert any(a["activity"] == "eva" for a in body["timeline"])
    assert body["traverse_out"]["metrics"]["energy_kWh"] > 0


def test_simulate_sep_diverts():
    plan = client.post("/api/v1/mission/plan", json={"target_ids": ["T02"], "profiles": ["safe"]}).json()
    route = plan["eva"]["routes"][0]
    at = len(route["cells"]) // 3
    res = client.post("/api/v1/simulate", json={"route": route, "scenario": "sep_event", "scenario_at_index": at})
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


def test_eva_outside_boxwork_uses_regional_terrain():
    """S03 (Yellowknife Bay) está fuera del DEM local de 1 m: la EVA se planifica en un
    recorte de la regional a 10 m con umbrales humanos (doc §4.7)."""
    base = {"lon": 137.42009295, "lat": -4.59310427}
    trav = client.post("/api/v1/routes/traverse", json={"base": base, "target_ids": ["S03", "T02"]}).json()
    by_target = {t: p for p in trav["parkings"] for t in p["target_ids"]}
    for target, cell_m in (("S03", 10.0), ("T02", 4.0)):
        pk = by_target[target]
        res = client.post("/api/v1/routes/eva", json={"rover": {"lon": pk["lon"], "lat": pk["lat"]},
                                                      "target_ids": [target]})
        assert res.status_code == 200, res.text
        routes = res.json()
        assert len(routes) == 3 and all(r["return_ok"] for r in routes)
        assert {r["terrain_cell_m"] for r in routes} == {cell_m}
