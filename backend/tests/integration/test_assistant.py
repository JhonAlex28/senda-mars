"""Herramientas del asistente y planificación de salidas contra los datos reales del sitio,
y el endpoint HTTP con un modelo falso en lugar del LLM."""
import json

from fastapi.testclient import TestClient

from senda.adapters.inbound.http.dependencies import chat_uc
from senda.application.assistant.conversation import AssistantMessage, ToolCall
from senda.application.assistant.tools import MissionContext, MissionTools
from senda.application.use_cases.assistant import ChatWithAssistant
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment
from senda.application.use_cases.plan_outing import PlanOuting
from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse
from senda.application.use_cases.targets import ListTargets
from senda.container import get_container
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import Hazard
from senda.domain.services.readiness import Check, Readiness, Verdict
from senda.main import app


class _NoGo:
    def execute(self):
        return Readiness(Verdict.NO_GO, 1, "12:00", [
            Check("dust", "Dust opacity", 4.0, "tau", Verdict.NO_GO, "Mastcam")])


def _outing(assess=None) -> PlanOuting:
    c = get_container()
    return PlanOuting(assess or AssessReadiness(c.environment_repo), ListTargets(c.target_repo),
                      PlanTraverse(c.target_repo, c.terrain), PlanEva(c.target_repo, c.terrain))


def _tools(context: MissionContext = MissionContext(), assess=None) -> MissionTools:
    c = get_container()
    return MissionTools(AssessReadiness(c.environment_repo), GetEnvironment(c.environment_repo),
                        ListTargets(c.target_repo), _outing(assess), c.knowledge, context)


def _run(tools, name, **args):
    result = tools.execute(ToolCall("x", name, args))
    return result, (None if result.is_error else json.loads(result.content))


def _base() -> GeoPoint:
    return next(t for t in get_container().target_repo.list_all() if t.is_base).location


# ---------- PlanOuting ----------

def test_outing_without_targets_picks_by_priority_and_plans_every_leg():
    plan = _outing().execute(_base())
    assert plan.planned and plan.target_ids[0] in {"T05", "T06"}   # prioridad 14
    assert set(plan.evas) == {p.id for p in plan.traverse.parkings}
    assert plan.traverse_profile and set(plan.eva_profiles) == set(plan.evas)


def test_time_budget_drops_lowest_priority_targets_until_it_fits():
    full = _outing().execute(_base())
    short = _outing().execute(_base(), budget_min=120)
    assert short.total_min <= 120 < full.total_min
    assert short.dropped and all(d.reason == "time" for d in short.dropped)
    assert {"T05", "T06"} <= set(short.target_ids)   # los de mayor prioridad se quedan


def test_no_go_conditions_plan_nothing():
    plan = _outing(_NoGo()).execute(_base())
    assert not plan.planned and plan.readiness.verdict is Verdict.NO_GO


# ---------- Herramientas ----------

def test_plan_outing_tool_logs_full_plan_and_sends_a_summary():
    tools = _tools()
    _, body = _run(tools, "plan_outing", target_ids=["T03"], speed_factor=0.7)
    assert body["planned"] and body["shown_on_screen"]
    assert body["targets"][0]["id"] == "T03"
    assert "oxygen_left_pct" in body["spacewalks"][0] and "points" not in body["rover"]
    assert tools.log.outing.conditions.speed_factor == 0.7
    assert tools.log.outing.traverse.routes[0].points   # el plan completo, para el mapa


def test_target_ids_copied_with_their_names_still_work():
    tools = _tools()
    _, body = _run(tools, "plan_outing", target_ids=["T05 Valle de la Luna", "T06"])
    assert [t["id"] for t in body["targets"]] == ["T05", "T06"]
    result, _ = _run(tools, "plan_outing", target_ids=["target1"])
    assert result.is_error and "Valid target ids: T02" in result.content


def test_plan_outing_starts_from_the_screen_base_and_hazards():
    zone = Hazard(GeoPoint(137.40, -4.70), 50)
    tools = _tools(MissionContext(base=_base(), hazards=(zone,)))
    _, body = _run(tools, "plan_outing", target_ids=["T03"])
    assert body["scenario"]["danger_zones"] == 1
    assert tools.log.outing.hazards == [zone]


def test_plan_outing_reports_no_go():
    tools = _tools(assess=_NoGo())
    _, body = _run(tools, "plan_outing")
    assert body == {"verdict": "no_go", "planned": False,
                    "conditions_flagged": ["Dust opacity: 4.0 tau (no_go, Mastcam)"],
                    "why_not_planned": "conditions are no_go", "dropped": []}


def test_adjust_view_needs_a_plan_and_valid_values():
    tools = _tools()
    result, _ = _run(tools, "adjust_view", screen="go")
    assert result.is_error   # no hay plan en pantalla
    tools = _tools(MissionContext(has_plan=True))
    _, body = _run(tools, "adjust_view", profile="scientific", screen="go")
    assert body["applied"] and tools.log.view.screen == "go"
    result, _ = _run(tools, "adjust_view", screen="moon")
    assert result.is_error


def test_invalid_inputs_become_tool_errors():
    tools = _tools()
    for args in ({"target_ids": ["NOPE"]}, {"speed_factor": 9}, {"time_available_min": 5},
                 {"profile": "scenic"}, {"hazards": [{"lon": 1}]}):
        result, _ = _run(tools, "plan_outing", **args)
        assert result.is_error, args


def test_targets_come_sorted_by_priority():
    _, body = _run(_tools(), "list_science_targets")
    scores = [t["priority"] for t in body["targets_by_priority"]]
    assert scores == sorted(scores, reverse=True)


def test_explain_system_reads_the_knowledge_base():
    tools = _tools()
    spec = next(s for s in tools.specs if s.name == "explain_system")
    assert "readiness" in spec.input_schema["properties"]["topic"]["enum"]
    _, body = _run(tools, "explain_system", topic="readiness")
    assert "RAD" in body["content"]
    result, _ = _run(tools, "explain_system", topic="cooking")
    assert result.is_error


# ---------- Endpoint ----------

class _FakeModel:
    def __init__(self):
        self.calls = 0

    def next_turn(self, system, messages, tools):
        self.calls += 1
        if self.calls == 1:
            return AssistantMessage("", (ToolCall("a", "plan_outing",
                                                  {"time_available_min": 180}),))
        return AssistantMessage("Plan cargado: perfil seguro.")


def _post(json_body, build):
    app.dependency_overrides[chat_uc] = lambda: build
    try:
        return TestClient(app).post("/api/v1/assistant/chat", json=json_body)
    finally:
        app.dependency_overrides.clear()


def test_chat_endpoint_returns_the_plan_to_load_on_screen():
    res = _post({"messages": [{"role": "user", "content": "Prepara la salida, tengo 3 horas"}],
                 "mission": {"goals": ["T03"], "hazards": [], "has_plan": False}},
                lambda ctx: ChatWithAssistant(_FakeModel(), _tools(ctx)))
    assert res.status_code == 200
    body = res.json()
    assert body["reply"].startswith("Plan cargado")
    assert body["tools_used"] == ["plan_outing"]
    outing = body["outing"]
    assert outing["planned"] and outing["total_duration_min"] <= 180
    assert outing["traverse"]["routes"][0]["points"]
    assert set(outing["evas"]) == set(outing["eva_profiles"])
    assert body["view"] is None


def test_chat_without_model_is_503():
    res = _post({"messages": [{"role": "user", "content": "hola"}]}, None)
    assert res.status_code == 503


class _Pingable:
    def __init__(self, up):
        self.up = up

    def is_reachable(self):
        return self.up


def _status(enabled, model):
    from senda.adapters.inbound.http.dependencies import assistant_model, assistant_settings
    from senda.config import Settings
    base = get_container().settings
    app.dependency_overrides[assistant_settings] = lambda: Settings(
        base.data_dir, base.cors_origins, assistant_enabled=enabled)
    app.dependency_overrides[assistant_model] = lambda: model
    try:
        return TestClient(app).get("/api/v1/assistant/status").json()
    finally:
        app.dependency_overrides.clear()


def test_status_tells_the_frontend_why_the_copilot_is_unavailable():
    assert _status(False, None) == {"enabled": False, "reachable": False, "model": None}
    down = _status(True, _Pingable(False))
    assert down["enabled"] and not down["reachable"]   # activado, pero Ollama no responde
    assert _status(True, _Pingable(True))["reachable"]


def test_adjust_view_reads_values_by_meaning():
    tools = _tools(MissionContext(has_plan=True))
    _, body = _run(tools, "adjust_view", profile="go", screen="go")
    assert body["screen"] == "go" and body["profile"] is None
    _, body = _run(tools, "adjust_view", screen="simulation", profile="scientific")
    assert body == {"applied": True, "profile": "scientific", "screen": "go"}


def test_current_plan_reports_what_is_on_screen():
    _, empty = _run(_tools(MissionContext(goals=("T03",))), "get_current_plan")
    assert empty["has_plan"] is False and empty["selected_targets"] == ["T03"]

    on_screen = {"rover": {"profile": "safe", "battery_left_pct": 91.0}, "spacewalks": []}
    _, body = _run(_tools(MissionContext(has_plan=True, screen="walk", plan=on_screen)),
                   "get_current_plan")
    assert body["has_plan"] and body["screen"] == "walk" and body["rover"]["profile"] == "safe"

    tools = _tools()
    _run(tools, "plan_outing", target_ids=["T03"])
    _, fresh = _run(tools, "get_current_plan")   # lo recién planificado manda sobre lo anterior
    assert fresh["source"] == "planned in this conversation" and fresh["targets"][0]["id"] == "T03"


def test_chat_accepts_the_plan_summary_from_the_frontend():
    plan = {"rover": {"profile": "safe", "duration_min": 32.5, "distance_m": 3351, "safety_pct": 98,
                      "resource_left_pct": 90.2, "return_ok": True},
            "spacewalks": [{"parking": "P1", "targets": ["T03"], "profile": "scientific",
                            "duration_min": 58.0, "distance_m": 510, "safety_pct": 81,
                            "resource_left_pct": 88.0, "return_ok": True}]}

    class _AskPlan:
        def __init__(self):
            self.n = 0

        def next_turn(self, system, messages, tools):
            self.n += 1
            if self.n == 1:
                return AssistantMessage("", (ToolCall("p", "get_current_plan", {}),))
            return AssistantMessage(messages[-1].results[0].content)

    res = _post({"messages": [{"role": "user", "content": "¿Cuánto oxígeno queda?"}],
                 "mission": {"has_plan": True, "screen": "walk", "plan": plan}},
                lambda ctx: ChatWithAssistant(_AskPlan(), _tools(ctx)))
    body = json.loads(res.json()["reply"])
    assert body["spacewalks"][0]["oxygen_left_pct"] == 88.0
    assert body["total_duration_min"] == 90.5
