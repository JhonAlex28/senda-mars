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


def test_routes_not_implemented_yet():
    assert client.post("/api/v1/routes").status_code == 501
