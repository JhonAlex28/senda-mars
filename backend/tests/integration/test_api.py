from fastapi.testclient import TestClient

from senda.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_targets_from_json():
    res = client.get("/api/v1/targets")
    assert res.status_code == 200
    targets = res.json()
    assert len(targets) == 8
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
