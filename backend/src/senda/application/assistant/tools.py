"""Herramientas del asistente: cada una delega en un caso de uso existente.

El asistente no calcula nada por su cuenta. Las cifras que recibe son un resumen de lo que
devolvió el planificador; los planes completos y los cambios de vista se guardan en
`MissionTools.log`, y el frontend los aplica tal cual en la pantalla del usuario."""
from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable

from senda.application.assistant.conversation import ToolCall, ToolResult, ToolSpec
from senda.application.ports.outbound import KnowledgeBase
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment
from senda.application.use_cases.mission_log import CrewRoster, MissionCalendar
from senda.application.use_cases.plan_outing import OutingPlan, PlanOuting
from senda.application.use_cases.targets import ListTargets
from senda.domain.errors import DomainError, TargetNotFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import Conditions, Hazard, RoutePlan, RouteProfile
from senda.domain.models.target import ScienceTarget
from senda.domain.services.readiness import Readiness, Verdict

PROFILES = [p.value for p in RouteProfile]
SCREENS = ["plan", "walk", "go"]
_SCREEN_WORDS = {"plan": "plan", "rover": "plan", "walk": "walk", "eva": "walk",
                 "spacewalks": "walk", "go": "go", "simulation": "go", "simulate": "go",
                 "start": "go"}

SPECS: tuple[ToolSpec, ...] = (
    ToolSpec(
        "plan_outing",
        "Plan a complete outing and load it on the user's screen. It checks the conditions, "
        "picks science targets (by priority if none are given) that fit the time available, "
        "plans the rover traverse and the walking EVA at each parking spot, and picks the "
        "safest route that can return. Use it whenever the user asks for a route, outing, "
        "plan, EVA, traverse or where to go.",
        {"type": "object", "properties": {
            "target_ids": {"type": "array", "items": {"type": "string"},
                           "description": "Target ids in priority order. Omit to choose by "
                                          "priority."},
            "time_available_min": {"type": "number", "minimum": 30, "maximum": 720,
                                   "description": "Total time the crew has, in minutes "
                                                  "(3 hours = 180)."},
            "profile": {"type": "string", "enum": PROFILES,
                        "description": "Only if the user asks for one."},
            "day": {"type": "string", "enum": ["today", "tomorrow"],
                    "description": "Day the outing is for. 'tomorrow' if the user says tomorrow: "
                                   "the plan is then saved in the calendar for that day."},
            "speed_factor": {"type": "number", "exclusiveMinimum": 0.1, "maximum": 1.5,
                             "description": "0.7 for a dust storm. Default 1."},
            "o2_multiplier": {"type": "number", "minimum": 1, "maximum": 3,
                              "description": "1.5 for a suit leak. Default 1."},
            "hazards": {"type": "array", "description": "New circular no-go zones.",
                        "items": {"type": "object", "properties": {
                            "lon": {"type": "number"}, "lat": {"type": "number"},
                            "radius_m": {"type": "number", "exclusiveMinimum": 0,
                                         "maximum": 500}},
                            "required": ["lon", "lat", "radius_m"]}},
        }},
    ),
    ToolSpec(
        "adjust_view",
        "Change what the user sees without planning again: the route profile and/or the "
        "screen (plan = rover route, walk = spacewalks, go = start the simulation).",
        {"type": "object", "properties": {
            "profile": {"type": "string", "enum": PROFILES},
            "screen": {"type": "string", "enum": SCREENS},
        }},
    ),
    ToolSpec(
        "get_current_plan",
        "The plan the user has on screen right now: targets, chosen rover route with time, "
        "distance and battery left, and each spacewalk with time and oxygen left. Use it for "
        "questions about the current plan.",
        {"type": "object", "properties": {}},
    ),
    ToolSpec(
        "list_saved_plans",
        "Plans saved in the mission calendar for a day: title, sol, status, who made it, targets "
        "and total time. Use it for questions like 'what is planned for tomorrow?'.",
        {"type": "object", "properties": {
            "day": {"type": "string", "enum": ["today", "tomorrow", "all"],
                    "description": "Default today."}}},
    ),
    ToolSpec(
        "save_plan",
        "Save the plan on screen in the mission calendar for a day, so it can be reopened later. "
        "Use it when the user asks to save or keep the plan, or plans for another day.",
        {"type": "object", "properties": {
            "day": {"type": "string", "enum": ["today", "tomorrow"]},
            "title": {"type": "string", "description": "Short name, optional."}},
         "required": ["day"]},
    ),
    ToolSpec(
        "open_saved_plan",
        "Load a saved plan back on screen. Give plan_id from list_saved_plans, or day if there "
        "is a single plan that day.",
        {"type": "object", "properties": {
            "plan_id": {"type": "string"},
            "day": {"type": "string", "enum": ["today", "tomorrow"]}}},
    ),
    ToolSpec(
        "get_mission_conditions",
        "Current Martian environment and the EVA readiness verdict (go / caution / no_go) "
        "with each measurement and its instrument. Only for questions about the weather or "
        "conditions; to plan an outing use plan_outing, which checks them itself.",
        {"type": "object", "properties": {}},
    ),
    ToolSpec(
        "list_science_targets",
        "All science targets: id, name, category, priority score (out of 15) and on-site task "
        "duration. Use it when the user asks about the targets or places.",
        {"type": "object", "properties": {}},
    ),
)


@dataclass(frozen=True)
class MissionContext:
    """Lo que el usuario tiene ahora en pantalla (lo envía el frontend)."""
    base: GeoPoint | None = None
    goals: tuple[str, ...] = ()
    hazards: tuple[Hazard, ...] = ()
    has_plan: bool = False
    screen: str = "plan"                      # plan | walk | go | globe
    plan: dict[str, Any] | None = None        # resumen del plan en pantalla (cifras del planificador)

    def describe(self) -> str:
        goals = ", ".join(self.goals) or "none"
        plan = "a plan is loaded" if self.has_plan else "no plan loaded yet"
        return (f"Current screen: {self.screen}; selected targets: {goals}; danger zones "
                f"marked: {len(self.hazards)}; {plan}.")


@dataclass(frozen=True)
class ViewChange:
    profile: RouteProfile | None = None
    screen: str | None = None


@dataclass(frozen=True)
class SaveRequest:
    sol: int
    title: str | None = None


@dataclass
class PlanLog:
    """Resultados reales de esta conversación, para aplicarlos en la pantalla."""
    readiness: Readiness | None = None
    outing: OutingPlan | None = None
    view: ViewChange | None = None
    save: SaveRequest | None = None          # el frontend guarda lo que hay en pantalla
    open_plan_id: str | None = None          # el frontend carga ese plan guardado
    tools_used: list[str] = field(default_factory=list)


class InvalidToolInput(Exception):
    pass


def _explain_spec(topics: dict[str, str]) -> ToolSpec:
    listing = "; ".join(f"{name} ({title})" for name, title in topics.items())
    return ToolSpec(
        "explain_system",
        "Official SENDA documentation on one topic. Use it to explain how SENDA works. "
        f"Topics: {listing}.",
        {"type": "object",
         "properties": {"topic": {"type": "string", "enum": list(topics)}},
         "required": ["topic"]},
    )


class MissionTools:
    """Ejecuta las llamadas a herramientas del modelo contra los casos de uso."""

    def __init__(self, assess: AssessReadiness, environment: GetEnvironment,
                 targets: ListTargets, outing: PlanOuting, knowledge: KnowledgeBase,
                 context: MissionContext = MissionContext(),
                 calendar: MissionCalendar | None = None,
                 crew: CrewRoster | None = None) -> None:
        self._assess = assess
        self._environment = environment
        self._targets = targets
        self._outing = outing
        self._knowledge = knowledge
        self._context = context
        self._calendar = calendar
        self._crew = crew
        log_tools = {"list_saved_plans", "save_plan", "open_saved_plan"}
        specs = SPECS if calendar else tuple(s for s in SPECS if s.name not in log_tools)
        self.specs: tuple[ToolSpec, ...] = (*specs, _explain_spec(knowledge.topics()))
        self.log = PlanLog()
        self._handlers: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
            "plan_outing": self._plan_outing,
            "adjust_view": self._adjust_view,
            "get_current_plan": self._current_plan,
            "list_saved_plans": self._list_saved,
            "save_plan": self._save_plan,
            "open_saved_plan": self._open_saved,
            "get_mission_conditions": self._conditions,
            "list_science_targets": self._list_targets,
            "explain_system": self._explain,
        }

    def context_note(self) -> str:
        """Estado de la pantalla y catálogo de objetivos: así el modelo no inventa ids."""
        science = sorted((t for t in self._targets.execute() if not t.is_base),
                         key=lambda t: -t.rubric.total)
        catalog = "; ".join(f"{t.id} = {t.name} (priority {t.rubric.total})" for t in science)
        return f"{self._context.describe()}\nValid target ids, by priority: {catalog}."

    def execute(self, call: ToolCall) -> ToolResult:
        self.log.tools_used.append(call.name)
        handler = self._handlers.get(call.name)
        if handler is None:
            return ToolResult(call.id, f"Unknown tool '{call.name}'", is_error=True)
        try:
            payload = handler(call.arguments or {})
        except TargetNotFound as e:
            valid = ", ".join(t.id for t in self._targets.execute() if not t.is_base)
            return ToolResult(call.id, f"{e}. Valid target ids: {valid}", is_error=True)
        except (DomainError, InvalidToolInput) as e:
            return ToolResult(call.id, str(e), is_error=True)
        return ToolResult(call.id, json.dumps(payload, ensure_ascii=False))

    # ---------- handlers ----------

    def _plan_outing(self, args: dict[str, Any]) -> dict[str, Any]:
        ids = args.get("target_ids") or None
        if ids is not None and not (isinstance(ids, list) and all(isinstance(i, str) for i in ids)):
            raise InvalidToolInput("target_ids must be a list of target ids")
        if ids:   # el modelo a veces copia "T05 Valle de la Luna" o solo el nombre del sitio
            bases = {t.id for t in self._targets.execute() if t.is_base}
            ids = [self._resolve_id(i) for i in ids if i.strip()]
            ids = [i for i in ids if i not in bases] or None
        day = args.get("day")
        if day not in (None, "", "today", "tomorrow"):
            raise InvalidToolInput("day must be today or tomorrow")
        budget = _number(args, "time_available_min", None, 30, 720)
        conditions = Conditions(_number(args, "speed_factor", 1.0, 0.1, 1.5),
                                _number(args, "o2_multiplier", 1.0, 1.0, 3.0))
        hazards = [*self._context.hazards, *_hazards(args.get("hazards"))]
        plan = self._outing.execute(self._context.base or self._base().location, ids, budget,
                                    hazards, conditions, _profile(args.get("profile")))
        self.log.outing = plan
        self.log.readiness = plan.readiness
        self.log.view = None   # el plan nuevo trae su propia vista
        summary = _outing_summary(plan, self._names())
        # Planificar para otro día lo guarda en el calendario de ese día (un solo paso para el
        # modelo; antes tenía que encadenar save_plan y los modelos pequeños lo olvidaban)
        if day and plan.planned and self._calendar is not None:
            sol = self._calendar.resolve(day)
            self.log.save = SaveRequest(sol)
            summary["saved_in_calendar"] = {"day": day, "sol": sol}
        return summary

    def _adjust_view(self, args: dict[str, Any]) -> dict[str, Any]:
        # Los modelos pequeños confunden los campos (profile="go"): se interpreta cada valor
        # por lo que significa, no por el campo en que llegó.
        values = [str(v).strip().lower() for v in (args.get("profile"), args.get("screen")) if v]
        profile = next((RouteProfile(v) for v in values if v in PROFILES), None)
        screen = next((_SCREEN_WORDS[v] for v in values if v in _SCREEN_WORDS), None)
        if profile is None and screen is None:
            raise InvalidToolInput(f"Give a profile ({PROFILES}) and/or a screen ({SCREENS})")
        if not (self.log.outing or self._context.has_plan):
            raise InvalidToolInput("There is no plan on screen yet; call plan_outing first")
        self.log.view = ViewChange(profile, screen)
        return {"applied": True, "profile": profile.value if profile else None,
                "screen": screen}

    def _current_plan(self, _: dict[str, Any]) -> dict[str, Any]:
        # Si en esta conversación ya se planificó, ese plan es el que está en pantalla
        if self.log.outing and self.log.outing.planned:
            return {"source": "planned in this conversation",
                    **_outing_summary(self.log.outing, self._names())}
        if not self._context.plan:
            return {"has_plan": False, "screen": self._context.screen,
                    "selected_targets": list(self._context.goals),
                    "hint": "No routes yet. Offer to plan the outing with plan_outing."}
        return {"has_plan": True, "screen": self._context.screen, **self._context.plan}

    def _calendar_or_fail(self) -> MissionCalendar:
        if self._calendar is None:
            raise InvalidToolInput("The mission calendar is not available")
        return self._calendar

    def _list_saved(self, args: dict[str, Any]) -> dict[str, Any]:
        cal = self._calendar_or_fail()
        day = args.get("day") or "today"
        if day not in ("today", "tomorrow", "all"):
            raise InvalidToolInput("day must be today, tomorrow or all")
        plans = cal.for_day(None if day == "all" else day, everything=day == "all")
        names = {m.id: m.name for m in self._crew.get().members} if self._crew else {}
        today = cal.today()
        return {
            "day": day, "today_sol": today,
            "plans": [{"plan_id": p.id, "title": p.title, "sol": p.sol,
                       "when": "today" if p.sol == today else "tomorrow" if p.sol == today + 1
                       else f"sol {p.sol}",
                       "status": p.status, "created_by": names.get(p.created_by or "", p.created_by),
                       "targets": p.summary.get("targets", []),
                       "total_duration_min": p.summary.get("total_duration_min")}
                      for p in plans],
        }

    def _save_plan(self, args: dict[str, Any]) -> dict[str, Any]:
        cal = self._calendar_or_fail()
        day = args.get("day")
        if day not in ("today", "tomorrow"):
            raise InvalidToolInput("day must be today or tomorrow")
        if not (self.log.outing and self.log.outing.planned) and not self._context.has_plan:
            raise InvalidToolInput("There is no plan on screen to save; call plan_outing first")
        title = str(args.get("title") or "").strip()[:120] or None
        sol = cal.resolve(day)
        self.log.save = SaveRequest(sol, title)
        return {"saved_for": day, "sol": sol, "title": title,
                "note": "The screen saves the plan now; it appears in the mission calendar."}

    def _open_saved(self, args: dict[str, Any]) -> dict[str, Any]:
        cal = self._calendar_or_fail()
        plan_id = args.get("plan_id")
        if plan_id:
            plan = cal.get(str(plan_id))
        else:
            day = args.get("day") or "today"
            plans = cal.for_day(day)
            if not plans:
                raise InvalidToolInput(f"No saved plans for {day}")
            if len(plans) > 1:
                options = "; ".join(f"{p.id} = {p.title}" for p in plans)
                raise InvalidToolInput(f"Several plans for {day}, give plan_id: {options}")
            plan = plans[0]
        self.log.open_plan_id = plan.id
        self.log.outing = None     # lo que se abre reemplaza cualquier plan nuevo de esta charla
        return {"opened": plan.title, "sol": plan.sol, "targets": plan.summary.get("targets", []),
                "total_duration_min": plan.summary.get("total_duration_min")}

    def _conditions(self, _: dict[str, Any]) -> dict[str, Any]:
        readiness = self._assess.execute()
        env = self._environment.execute()
        self.log.readiness = readiness
        return {
            "sol": env.sol,
            "local_solar_time": env.local_solar_time,
            "note": "Single snapshot of the current sol; no forecast is available.",
            "temp_min_c": env.temp_min_c,
            "temp_max_c": env.temp_max_c,
            "verdict": readiness.verdict.value,
            "checks": [{"label": c.label, "value": c.value, "unit": c.unit,
                        "verdict": c.verdict.value, "source": c.source}
                       for c in readiness.checks],
        }

    def _list_targets(self, _: dict[str, Any]) -> dict[str, Any]:
        science = sorted((t for t in self._targets.execute() if not t.is_base),
                         key=lambda t: -t.rubric.total)
        return {"targets_by_priority": [_target_summary(t) for t in science]}

    def _explain(self, args: dict[str, Any]) -> dict[str, Any]:
        topic = str(args.get("topic", ""))
        text = self._knowledge.get(topic)
        if text is None:
            available = ", ".join(self._knowledge.topics())
            raise InvalidToolInput(f"Unknown topic '{topic}'. Available: {available}")
        return {"topic": topic, "content": text}

    # ---------- helpers ----------

    def _base(self) -> ScienceTarget:
        base = next((t for t in self._targets.execute() if t.is_base), None)
        if base is None:
            raise InvalidToolInput("The site has no base defined")
        return base

    def _names(self) -> dict[str, ScienceTarget]:
        return {t.id: t for t in self._targets.execute()}

    def _resolve_id(self, raw: str) -> str:
        """Id válido a partir de lo que mande el modelo: "S03", "S03 Yellowknife Bay" o
        "Yellowknife Bay". Si no reconoce nada devuelve el id tal cual y el error lista los
        válidos (el catálogo cambia más rápido que el reentrenamiento del modelo)."""
        targets = self._names()
        first = raw.strip().split()[0].strip(",;:").upper()
        if first in targets:
            return first
        wanted = _fold(raw)
        for t in targets.values():
            name = _fold(t.name)
            short = _fold(t.name.split("(")[0].split("—")[0].split("–")[0])
            if wanted and (wanted in name or (short and short in wanted)):
                return t.id
        return first


def _fold(text: str) -> str:
    """Minúsculas, sin tildes ni signos: para comparar nombres de sitios."""
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join("".join(ch if ch.isalnum() else " " for ch in plain.lower()).split())


def _outing_summary(plan: OutingPlan, targets: dict[str, ScienceTarget]) -> dict[str, Any]:
    """Lo mínimo que el modelo necesita para explicar el plan, con unidades explícitas."""
    def name(i: str) -> str:
        return targets[i].name if i in targets else i

    out: dict[str, Any] = {"verdict": plan.readiness.verdict.value,
                           "planned": plan.planned}
    flagged = [c for c in plan.readiness.checks if c.verdict is not Verdict.GO]
    if flagged:
        out["conditions_flagged"] = [f"{c.label}: {c.value} {c.unit} ({c.verdict.value}, "
                                     f"{_short_source(c.source)})" for c in flagged]
    if not plan.planned:
        out["why_not_planned"] = ("conditions are no_go" if plan.readiness.verdict is Verdict.NO_GO
                                  else "no target has a safe return")
        out["dropped"] = [{"id": d.id, "name": name(d.id), "reason": d.reason}
                          for d in plan.dropped]
        return out

    rover = plan.chosen_traverse()
    out.update({
        "shown_on_screen": True,
        "targets": [{"id": i, "name": name(i), "priority": targets[i].rubric.total,
                     "task_min": targets[i].task_minutes}
                    for i in plan.target_ids if i in targets and not targets[i].is_base],
        "dropped": [{"id": d.id, "name": name(d.id),
                     "reason": "not enough time" if d.reason == "time" else "no safe return"}
                    for d in plan.dropped],
        "time_available_min": plan.budget_min,
        "total_duration_min": plan.total_min,
        "rover": _leg(rover, "battery_left_pct") if rover else None,
        "spacewalks": [
            {"parking": p.id, "targets": p.target_ids,
             **_leg(r, "oxygen_left_pct")}
            for p in plan.traverse.parkings if (r := plan.chosen_eva(p.id))
        ],
        "scenario": {"speed_factor": plan.conditions.speed_factor,
                     "o2_multiplier": plan.conditions.o2_multiplier,
                     "danger_zones": len(plan.hazards)},
    })
    return out


def _short_source(source: str) -> str:
    """"Curiosity REMS Ground/Air Temperature Series (Ruíz et al. 2025)" → "Curiosity REMS":
    el instrumento basta; la cita completa alarga la respuesta del modelo."""
    words = source.split(" (")[0].split()
    return " ".join(words[:2]) if len(words) > 2 else " ".join(words)


def _leg(r: RoutePlan, resource_key: str) -> dict[str, Any]:
    return {"profile": r.profile.value, "duration_min": round(r.duration_min, 1),
            "distance_m": round(r.distance_m), "max_slope_deg": round(r.max_slope_deg, 1),
            "safety_pct": r.safety_pct, resource_key: round(r.resource.remaining_pct, 1)}


def _target_summary(t: ScienceTarget) -> dict[str, Any]:
    return {"id": t.id, "name": t.name, "category": t.category,
            "priority": t.rubric.total, "task_min": t.task_minutes,
            "description": t.description}


def _number(args: dict[str, Any], key: str, default: float | None,
            low: float, high: float) -> Any:
    raw = args.get(key)
    if raw is None:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError) as e:
        raise InvalidToolInput(f"{key} must be a number") from e
    if not low <= value <= high:
        raise InvalidToolInput(f"{key} must be between {low} and {high}")
    return value


def _profile(raw: Any) -> RouteProfile | None:
    if raw in (None, ""):
        return None
    try:
        return RouteProfile(raw)
    except ValueError as e:
        raise InvalidToolInput(f"profile must be one of {PROFILES}") from e


def _hazards(raw: Any) -> list[Hazard]:
    try:
        hazards = [Hazard(GeoPoint(float(h["lon"]), float(h["lat"])), float(h["radius_m"]))
                   for h in raw or []]
    except (KeyError, TypeError, ValueError) as e:
        raise InvalidToolInput(f"Invalid hazard: {e}") from e
    if any(not 0 < h.radius_m <= 500 for h in hazards):
        raise InvalidToolInput("hazard radius_m must be in (0, 500]")
    return hazards
