"""Registro de la misión: planes por sol, tripulación y procedimientos (base de datos temporal)."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from senda.adapters.outbound.persistence.sql_store import (CrewStore, ProcedureStore,
                                                           SqlMissionStore, normalize_url)
from senda.application.use_cases.mission_log import CrewRoster, MissionCalendar, ProcedureLog
from senda.container import get_container
from senda.domain.errors import InvalidMissionLog, PlanNotFound
from senda.domain.models.mission_log import DEFAULT_CREW
from senda.main import app


@pytest.fixture
def store(tmp_path):
    return SqlMissionStore(f"sqlite:///{(tmp_path / 'm.db').as_posix()}")


def _calendar(store):
    return MissionCalendar(store, get_container().environment_repo)


def test_today_and_tomorrow_follow_the_current_sol(store):
    cal = _calendar(store)
    today = get_container().environment_repo.get_current().sol
    assert cal.resolve("today") == today and cal.resolve("tomorrow") == today + 1
    assert cal.resolve(6000) == 6000
    with pytest.raises(InvalidMissionLog):
        cal.resolve("someday")


def test_save_list_update_and_delete_plans(store):
    cal = _calendar(store)
    a = cal.save(title="EVA a T03", day="today", site_id="mount-sharp", created_by="EVA-1",
                 summary={"total_duration_min": 58.3}, payload={"goals": ["T03"]})
    b = cal.save(title="Boxwork", day="tomorrow", site_id="mount-sharp", created_by="EVA-2",
                 summary={}, payload={"goals": ["T05", "T06"]})
    assert [p.id for p in cal.for_day("today")] == [a.id]
    assert [p.id for p in cal.for_day("tomorrow")] == [b.id]
    assert len(cal.for_day(everything=True)) == 2

    edited = cal.save(title="EVA a T03 y T02", day="today", site_id="mount-sharp", created_by="EVA-1",
                      summary={}, payload={"goals": ["T03", "T02"]}, plan_id=a.id)
    assert edited.created_at == a.created_at and edited.payload["goals"] == ["T03", "T02"]
    assert cal.set_status(a.id, "done").status == "done"

    cal.delete(b.id)
    with pytest.raises(PlanNotFound):
        cal.get(b.id)
    with pytest.raises(PlanNotFound):
        cal.save(title="x", day="today", site_id="s", created_by=None, summary={}, payload={},
                 plan_id="missing")


def test_crew_defaults_and_validation(store):
    roster = CrewRoster(CrewStore(store))
    assert roster.get() == DEFAULT_CREW              # primera vez: tripulación por defecto
    renamed = DEFAULT_CREW.__class__("ARES", DEFAULT_CREW.members[:1])
    assert roster.save(renamed).team_name == "ARES" and roster.get().team_name == "ARES"
    with pytest.raises(InvalidMissionLog):
        roster.save(DEFAULT_CREW.__class__("ARES", DEFAULT_CREW.members[:1] * 2))   # ids repetidos


def test_procedures_are_kept_per_site(store):
    log = ProcedureLog(ProcedureStore(store),
                       clock=lambda: datetime(2026, 11, 15, 12, tzinfo=timezone.utc))
    log.record("mount-sharp", "T05", "EVA-1", "plan-1")
    log.record("jezero", "J01")
    assert [r.target_id for r in log.history("mount-sharp")] == ["T05"]
    assert len(log.history()) == 2


def test_postgres_urls_use_psycopg():
    assert normalize_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("sqlite:///x.db") == "sqlite:///x.db"


def test_plans_api_round_trip():
    client = TestClient(app)
    created = client.post("/api/v1/plans", json={
        "title": "Mañana: boxwork", "day": "tomorrow", "created_by": "EVA-2",
        "summary": {"targets": ["T05"], "total_duration_min": 120.5},
        "payload": {"goals": ["T05"], "traverse": {"parkings": []}}})
    assert created.status_code == 201
    plan = created.json()
    listing = client.get("/api/v1/plans", params={"day": "tomorrow"}).json()
    assert listing["today_sol"] + 1 == plan["sol"]
    assert plan["id"] in [p["id"] for p in listing["plans"]]
    assert all(p["payload"] is None for p in listing["plans"])        # la lista no trae lo pesado
    assert client.get(f"/api/v1/plans/{plan['id']}").json()["payload"]["goals"] == ["T05"]
    assert client.patch(f"/api/v1/plans/{plan['id']}/status", json={"status": "done"}).json()["status"] == "done"
    assert client.delete(f"/api/v1/plans/{plan['id']}").status_code == 204
    assert client.get(f"/api/v1/plans/{plan['id']}").status_code == 404
    assert client.post("/api/v1/plans", json={"title": "", "payload": {}}).status_code == 422


def test_crew_and_procedures_api():
    client = TestClient(app)
    crew = client.get("/api/v1/crew").json()
    crew["team_name"] = "SENDA-ARES"
    assert client.put("/api/v1/crew", json=crew).json()["team_name"] == "SENDA-ARES"
    rec = client.post("/api/v1/procedures", json={"site_id": "mount-sharp", "target_id": "T03",
                                                   "crew_member": "EVA-1"})
    assert rec.status_code == 201
    assert any(r["id"] == rec.json()["id"]
               for r in client.get("/api/v1/procedures", params={"site_id": "mount-sharp"}).json())


# ---------- el copiloto y el calendario ----------

def _copilot(store, context=None):
    import json as _json
    from senda.application.assistant.conversation import ToolCall
    from senda.application.assistant.tools import MissionContext, MissionTools
    from senda.application.use_cases.environment import AssessReadiness, GetEnvironment
    from senda.application.use_cases.plan_outing import PlanOuting
    from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse
    from senda.application.use_cases.targets import ListTargets
    c = get_container()
    assess, targets = AssessReadiness(c.environment_repo), ListTargets(c.target_repo)
    tools = MissionTools(assess, GetEnvironment(c.environment_repo), targets,
                         PlanOuting(assess, targets, PlanTraverse(c.target_repo, c.terrain),
                                    PlanEva(c.target_repo, c.terrain)),
                         c.knowledge, context or MissionContext(), _calendar(store),
                         CrewRoster(CrewStore(store)))

    def run(name, **args):
        r = tools.execute(ToolCall("x", name, args))
        return r, (None if r.is_error else _json.loads(r.content))
    return tools, run


def test_copilot_lists_saved_plans_by_day_with_crew_names(store):
    _calendar(store).save(title="Boxwork", day="tomorrow", site_id="mount-sharp", created_by="EVA-2",
                          summary={"targets": ["T05", "T06"], "total_duration_min": 120.5}, payload={})
    tools, run = _copilot(store)
    assert {"list_saved_plans", "save_plan", "open_saved_plan"} <= {s.name for s in tools.specs}
    _, today = run("list_saved_plans")
    assert today["plans"] == []
    _, tomorrow = run("list_saved_plans", day="tomorrow")
    plan = tomorrow["plans"][0]
    assert plan["title"] == "Boxwork" and plan["when"] == "tomorrow"
    assert plan["created_by"] == "Astronaut 2" and plan["total_duration_min"] == 120.5


def test_copilot_save_needs_a_plan_and_asks_the_screen_to_save(store):
    from senda.application.assistant.tools import MissionContext
    _, run = _copilot(store)
    result, _ = run("save_plan", day="tomorrow")
    assert result.is_error                                # nada en pantalla todavía
    tools, run = _copilot(store, MissionContext(has_plan=True))
    _, body = run("save_plan", day="tomorrow", title="Plan B")
    assert body["sol"] == _calendar(store).today() + 1
    assert tools.log.save.sol == body["sol"] and tools.log.save.title == "Plan B"


def test_copilot_opens_a_saved_plan(store):
    cal = _calendar(store)
    a = cal.save(title="A", day="today", site_id="s", created_by=None, summary={}, payload={})
    tools, run = _copilot(store)
    _, body = run("open_saved_plan", day="today")
    assert body["opened"] == "A" and tools.log.open_plan_id == a.id
    cal.save(title="B", day="today", site_id="s", created_by=None, summary={}, payload={})
    result, _ = run("open_saved_plan", day="today")
    assert result.is_error and a.id in result.content    # varios: pide cuál, con sus ids
