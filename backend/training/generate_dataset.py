"""Genera los datos de entrenamiento del copiloto de SENDA con el planificador real.

Cada ejemplo es la conversación ideal completa, en el formato de chat con herramientas que usa
Qwen3 (el mismo que Ollama envía en producción):

  system    el prompt real de producción (con estado de pantalla, catálogo e idioma)
  user      una orden o pregunta, con muchas formas de decirla, en español o inglés
  assistant llamada a la herramienta correcta con los argumentos correctos
  tool      el resultado REAL del planificador (se ejecuta de verdad)
  assistant respuesta corta escrita solo con las cifras de ese resultado

Así el modelo aprende a decidir la herramienta y a copiar cifras, nunca a inventarlas.
Las frases no repiten las del examen (eval/cases.json): el examen mide generalización.

Uso (desde backend/):  python training/generate_dataset.py [--seed 7] [--scale 1.0]
Salida: training/data/train.jsonl, training/data/val.jsonl y training/data/stats.json
"""
from __future__ import annotations

import argparse
import tempfile
import re
import json
import random
import sys
from collections import Counter
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "src"))
sys.path.insert(0, str(ROOT))

from qa_bank import OFF_TOPIC, QA  # noqa: E402

from senda.application.assistant.conversation import ToolCall  # noqa: E402
from senda.application.assistant.language import reply_language  # noqa: E402
from senda.application.assistant.tools import MissionContext, MissionTools  # noqa: E402
from senda.application.use_cases.assistant import DONE_MARK, _system_prompt  # noqa: E402
from senda.adapters.outbound.persistence.sql_store import CrewStore, SqlMissionStore  # noqa: E402
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment  # noqa: E402
from senda.application.use_cases.mission_log import CrewRoster, MissionCalendar  # noqa: E402
from senda.application.use_cases.plan_outing import PlanOuting  # noqa: E402
from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse  # noqa: E402
from senda.application.use_cases.targets import ListTargets  # noqa: E402
from senda.container import get_container  # noqa: E402
from senda.domain.services.readiness import Readiness, Verdict  # noqa: E402

PROFILE_ES = {"safe": "segura", "scientific": "científica", "fast": "rápida"}
PROFILE_EN = {"safe": "safest", "scientific": "science", "fast": "quickest"}


# ---------- infraestructura ----------

class MemoOuting:
    """PlanOuting con caché: muchas frases piden lo mismo y el planificador tarda ~1 s."""

    def __init__(self, inner: PlanOuting) -> None:
        self._inner, self._cache = inner, {}

    def execute(self, base, target_ids=None, budget_min=None, hazards=None, conditions=None,
                profile=None):
        key = (base, tuple(target_ids or ()), budget_min, tuple(hazards or ()), conditions, profile)
        if key not in self._cache:
            kwargs = {} if conditions is None else {"conditions": conditions}
            self._cache[key] = self._inner.execute(base, target_ids, budget_min, hazards,
                                                   profile=profile, **kwargs)
        return self._cache[key]


class FixedReadiness:
    """Veredictos alternativos (precaución / no_go) para que el modelo aprenda a decir que no."""

    def __init__(self, readiness: Readiness) -> None:
        self._r = readiness

    def execute(self) -> Readiness:
        return self._r


class Factory:
    def __init__(self) -> None:
        c = get_container()
        self.c = c
        self.targets = ListTargets(c.target_repo)
        self.env = GetEnvironment(c.environment_repo)
        self.real = AssessReadiness(c.environment_repo)
        self._outings: dict[int, MemoOuting] = {}
        self.catalog = {t.id: t for t in self.targets.execute()}
        self.science = sorted((t for t in self.catalog.values() if not t.is_base),
                              key=lambda t: -t.rubric.total)
        tmp = Path(tempfile.mkdtemp(prefix="senda-gen-"))
        self.calendar = self._calendar(tmp / "full.db", seed=True)
        self.empty_calendar = self._calendar(tmp / "empty.db", seed=False)
        self.crew = CrewRoster(CrewStore(SqlMissionStore(f"sqlite:///{(tmp / 'full.db').as_posix()}")))
        self.today = self.calendar.today()

    def _calendar(self, path: Path, seed: bool) -> MissionCalendar:
        store = SqlMissionStore(f"sqlite:///{path.as_posix()}")
        cal = MissionCalendar(store, self.c.environment_repo)
        if seed:   # un calendario realista: dos planes hoy, uno mañana, uno pasado mañana
            for title, day, targets, total, who in (
                    ("Boxwork drill run", "today", ["T05", "T06"], 128.4, "EVA-1"),
                    ("Short EVA to Volcán Peña Blanca", "today", ["T03"], 58.3, "EVA-2"),
                    ("Altadena and the ridge", "tomorrow", ["T02", "T04"], 101.7, "EVA-1"),
                    ("Monte Grande polygons", self.c.environment_repo.get_current().sol + 2, ["T07"], 74.0, "EVA-2")):
                cal.save(title=title, day=day, site_id="mount-sharp", created_by=who,
                         summary={"targets": targets, "total_duration_min": total}, payload={})
        return cal

    def tools(self, context: MissionContext, assess=None, calendar: MissionCalendar | None = None) -> MissionTools:
        assess = assess or self.real
        key = id(assess)
        if key not in self._outings:
            self._outings[key] = MemoOuting(PlanOuting(
                assess, self.targets, PlanTraverse(self.c.target_repo, self.c.terrain),
                PlanEva(self.c.target_repo, self.c.terrain)))
        return MissionTools(assess, self.env, self.targets, self._outings[key],
                            self.c.knowledge, context, calendar or self.calendar, self.crew)


def tool_specs(tools: MissionTools) -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": t.name, "description": t.description,
                                              "parameters": t.input_schema}} for t in tools.specs]


def conversation(f: Factory, user: str, calls: list[tuple[str, dict]],
                 write: Callable[[list[dict], str], str], context: MissionContext = MissionContext(),
                 assess=None, history: list[str] | None = None,
                 calendar: MissionCalendar | None = None) -> dict[str, Any] | None:
    """Arma la conversación ideal ejecutando de verdad cada herramienta."""
    tools = f.tools(context, assess, calendar)
    lang = "es" if reply_language(user) == "Spanish" else "en"   # el mismo detector que producción
    messages: list[dict[str, Any]] = [{"role": "system",
                                       "content": _system_prompt(tools.context_note(), user)}]
    for past in history or []:   # igual que en producción: respuestas previas compactadas
        messages += [{"role": "user", "content": past}, {"role": "assistant", "content": DONE_MARK}]
    messages.append({"role": "user", "content": user})
    payloads = []
    for name, args in calls:
        result = tools.execute(ToolCall("c", name, args))
        content = f"ERROR: {result.content}" if result.is_error else result.content
        messages.append({"role": "assistant", "content": "",
                         "tool_calls": [{"type": "function", "function": {"name": name, "arguments": args}}]})
        messages.append({"role": "tool", "content": content})
        payloads.append({"name": name, "error": result.is_error,
                         "data": None if result.is_error else json.loads(result.content),
                         "text": result.content})
    answer = write(payloads, lang)
    if not answer:
        return None
    messages.append({"role": "assistant", "content": answer})
    return {"messages": messages, "tools": tool_specs(tools)}


def pick(rng: random.Random, *options):
    return rng.choice(options)


# ---------- planificar una salida ----------

TIME_ES = {60: ["tengo una hora", "solo hay 1 hora", "contamos con 60 minutos"],
           90: ["tengo hora y media", "disponemos de 90 minutos", "tenemos 1 hora y 30 minutos"],
           120: ["tengo 2 horas", "tenemos dos horas", "hay 120 minutos disponibles"],
           150: ["tengo dos horas y media", "son 150 minutos"],
           180: ["tengo 3 horas", "tenemos tres horas libres", "disponemos de 180 minutos"],
           240: ["tengo 4 horas", "tenemos cuatro horas", "hay 240 minutos"],
           300: ["tenemos 5 horas", "contamos con cinco horas"]}
TIME_EN = {60: ["I have one hour", "we only have 60 minutes"],
           90: ["I have an hour and a half", "we've got 90 minutes"],
           120: ["I have 2 hours", "we have two hours"],
           150: ["we have two and a half hours"],
           180: ["I have 3 hours", "we've got three hours"],
           240: ["I have 4 hours", "we have four hours available"],
           300: ["we have five hours"]}
DAY_ES = ["", "hoy", "mañana", "esta tarde", "para mañana", "del próximo sol"]
DAY_EN = ["", "today", "tomorrow", "this afternoon", "for tomorrow", "for the next sol"]
VERB_ES = ["Prepara", "Organiza", "Planifica", "Arma", "Armemos", "Hazme", "Necesito", "Quiero",
           "¿Puedes preparar", "Ayúdame a organizar", "Monta", "Diseña", "Proponme", "Genera", "Calcula"]
OBJ_ES = ["la salida", "la misión", "la jornada", "una EVA", "la excursión", "el plan de rutas",
          "la ruta", "la salida de exploración", "una salida", "el recorrido"]
VERB_EN = ["Plan", "Prepare", "Organize", "Set up", "Put together", "Build", "I need", "Can you plan",
           "Help me plan", "Make", "Work out"]
OBJ_EN = ["the outing", "the mission", "an EVA", "a trip", "the route plan", "our exploration day",
          "the traverse", "a sortie"]
STORM_ES = ["hay tormenta de polvo", "se viene una tormenta de polvo", "con la tormenta de polvo que hay",
            "el polvo está fuerte"]
STORM_EN = ["there's a dust storm", "a dust storm is coming", "with this dust storm"]
LEAK_ES = ["un traje tiene una fuga", "hay una fuga en un traje", "un traje pierde oxígeno"]
LEAK_EN = ["one suit has a leak", "there's a suit leak"]
PROFILE_ASK_ES = {"fast": ["lo más rápido posible", "por la ruta rápida"],
                  "safe": ["lo más seguro posible", "por la ruta segura"],
                  "scientific": ["priorizando la ciencia", "por la ruta científica"]}
PROFILE_ASK_EN = {"fast": ["as fast as possible", "using the quickest route"],
                  "safe": ["as safely as possible", "on the safest route"],
                  "scientific": ["prioritizing science", "on the science route"]}
QUESTION_ES = ["¿A dónde vamos {day}?", "¿Qué podemos visitar {day}?", "¿Qué lugares conviene visitar {day}?",
               "¿Qué hacemos {day} en la misión?", "¿Cuál sería el mejor plan {day}?"]
QUESTION_EN = ["Where should we go {day}?", "What can we visit {day}?", "What's the best plan {day}?",
               "Which places should we visit {day}?"]


def _join(parts: list[str]) -> str:
    text = re.sub(r"\s+", " ", " ".join(p for p in parts if p)).replace(" ,", ",").strip()
    text = text[0].upper() + text[1:]
    if text.startswith("¿") and not text.endswith("?"):
        text += "?"
    return text


def plan_order(rng: random.Random, f: Factory, lang: str) -> tuple[str, dict]:
    es = lang == "es"
    args: dict[str, Any] = {}
    extras: list[str] = []
    if rng.random() < 0.65:
        minutes = rng.choice(list(TIME_ES))
        args["time_available_min"] = minutes
        extras.append(rng.choice(TIME_ES[minutes] if es else TIME_EN[minutes]))
    if rng.random() < 0.25:
        args["speed_factor"] = 0.7
        extras.append(rng.choice(STORM_ES if es else STORM_EN))
    elif rng.random() < 0.1:
        args["o2_multiplier"] = 1.5
        extras.append(rng.choice(LEAK_ES if es else LEAK_EN))
    if rng.random() < 0.3:
        chosen = rng.sample(f.science, rng.randint(1, 3))
        args["target_ids"] = [t.id for t in chosen]
        names = [t.id if rng.random() < 0.5 else t.name.split(" (")[0] for t in chosen]
        joined = (" y " if es else " and ").join([", ".join(names[:-1]), names[-1]] if len(names) > 1 else names)
        extras.insert(0, (pick(rng, "a", "hacia", "para visitar") if es else pick(rng, "to", "visiting")) + " " + joined)
    if rng.random() < 0.15:
        profile = rng.choice(["fast", "safe", "scientific"])
        args["profile"] = profile
        extras.append(rng.choice(PROFILE_ASK_ES[profile] if es else PROFILE_ASK_EN[profile]))
    day = rng.choice(DAY_ES if es else DAY_EN)
    if day in ("mañana", "para mañana", "del próximo sol", "tomorrow", "for tomorrow", "for the next sol"):
        args["day"] = "tomorrow"   # planificar para mañana lo guarda en el calendario de mañana
    if rng.random() < 0.25 and "target_ids" not in args:
        text = rng.choice(QUESTION_ES if es else QUESTION_EN).format(day=day).replace("  ", " ").replace(" ?", "?")
        if extras:
            text = f"{text[:-1]}, {', '.join(extras)}?" if text.endswith("?") else f"{text} {', '.join(extras)}"
        return text, args
    verb = rng.choice(VERB_ES if es else VERB_EN)
    obj = rng.choice(OBJ_ES if es else OBJ_EN)
    sep = ", " if extras else ""
    return _join([verb, obj, day + sep if day else ("," if extras else ""), ", ".join(extras)]), args


def _names(f: Factory, ids: list[str], lang: str) -> str:
    names = [f"{f.catalog[i].name.split(' (')[0]} ({i})" for i in ids if i in f.catalog]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + (" y " if lang == "es" else " and ") + names[-1]


def write_outing(f: Factory, user: str):
    tomorrow = any(w in user.lower() for w in ("mañana", "tomorrow", "próximo sol", "next sol"))

    def write(payloads: list[dict], lang: str) -> str:
        p = payloads[-1]
        if p["error"]:
            return ""
        d = p["data"]
        es = lang == "es"
        flagged = d.get("conditions_flagged", [])
        if not d["planned"]:
            reason = "; ".join(flagged) if flagged else ""
            if d["verdict"] == "no_go":
                return (f"NO GO: {reason}. Con estas condiciones no es seguro salir, así que no planifiqué ninguna salida."
                        if es else f"NO GO: {reason}. It is not safe to go out in these conditions, so I did not plan an outing.")
            return ("No encontré objetivos con un regreso seguro, así que no cargué ningún plan."
                    if es else "I found no targets with a safe way back, so I did not load a plan.")
        ids = [t["id"] for t in d["targets"]]
        rover = d["rover"]
        profile = (PROFILE_ES if es else PROFILE_EN)[rover["profile"]]
        budget = d.get("time_available_min")
        total = d["total_duration_min"]
        storm = d["scenario"]["speed_factor"] < 1
        leak = d["scenario"]["o2_multiplier"] > 1
        min_o2 = min((w["oxygen_left_pct"] for w in d["spacewalks"]), default=None)
        if es:
            out = [f"Listo, cargué en el mapa una salida de {total:g} min"
                   + (f" de los {budget:g} disponibles" if budget else "") + f": {_names(f, ids, 'es')}."]
            out.append(f"Rover por la ruta {profile} ({rover['duration_min']:g} min, vuelve con {rover['battery_left_pct']:g}% de batería)"
                       + (f"; en las caminatas el oxígeno más bajo queda en {min_o2:g}%." if min_o2 is not None else "."))
            if d["dropped"]:
                reasons = {"not enough time": "por falta de tiempo", "no safe return": "sin regreso seguro"}
                out.append("Quedaron fuera " + ", ".join(f"{x['name'].split(' (')[0]} ({x['id']}, {reasons.get(x['reason'], x['reason'])})"
                                                          for x in d["dropped"]) + ".")
            if storm:
                out.append("Calculé todo con la tormenta de polvo (velocidad al 70%).")
            if leak:
                out.append("Tuve en cuenta la fuga del traje (oxígeno ×1,5).")
            if flagged:
                out.append("Precaución: " + "; ".join(flagged) + ".")
            if d.get("saved_in_calendar"):
                out.append(f"Lo guardé en el calendario para mañana (sol {d['saved_in_calendar']['sol']}); el plan de hoy sigue ahí.")
            if tomorrow:
                out.append("Usé el clima de hoy: no hay pronóstico para mañana.")
        else:
            out = [f"Done, I loaded a {total:g}-minute outing on the map"
                   + (f" out of the {budget:g} available" if budget else "") + f": {_names(f, ids, 'en')}."]
            out.append(f"Rover on the {profile} route ({rover['duration_min']:g} min, back with {rover['battery_left_pct']:g}% battery)"
                       + (f"; the lowest oxygen on the walks is {min_o2:g}%." if min_o2 is not None else "."))
            if d["dropped"]:
                out.append("Left out: " + ", ".join(f"{x['name'].split(' (')[0]} ({x['id']}, {x['reason']})" for x in d["dropped"]) + ".")
            if storm:
                out.append("I planned everything with the dust storm (70% speed).")
            if leak:
                out.append("I accounted for the suit leak (oxygen ×1.5).")
            if flagged:
                out.append("Caution: " + "; ".join(flagged) + ".")
            if d.get("saved_in_calendar"):
                out.append(f"I saved it in the calendar for tomorrow (sol {d['saved_in_calendar']['sol']}); today's plan is kept.")
            if tomorrow:
                out.append("I used today's weather: there is no forecast for tomorrow.")
        return " ".join(out)
    return write


# ---------- veredictos alternativos ----------

def readiness_variants(f: Factory) -> list[Readiness]:
    base = f.real.execute()
    variants = []
    tweaks = {
        "dust": [(1.6, Verdict.CAUTION), (3.9, Verdict.NO_GO), (4.6, Verdict.NO_GO)],
        "wind": [(13.0, Verdict.CAUTION), (23.5, Verdict.NO_GO)],
        "temperature": [(-48.0, Verdict.CAUTION), (-66.0, Verdict.NO_GO)],
        "radiation": [(1.8, Verdict.CAUTION), (12.4, Verdict.NO_GO)],
    }
    for key, options in tweaks.items():
        for value, verdict in options:
            checks = [replace(c, value=value, verdict=verdict) if c.key == key else c for c in base.checks]
            worst = max((c.verdict for c in checks), key=lambda v: [Verdict.GO, Verdict.CAUTION, Verdict.NO_GO].index(v))
            variants.append(replace(base, verdict=worst, checks=checks))
    return variants


# ---------- clima ----------

COND_ES = ["¿Qué tal está el clima ahora?", "Dame el clima actual", "¿Cómo están las condiciones afuera?",
           "¿Hace mucho frío en Gale?", "¿Cómo está el viento?", "¿Es seguro hacer una EVA ahora?",
           "Reporte del tiempo, por favor", "¿Qué dicen REMS y RAD?", "¿Hay riesgo de radiación hoy?",
           "¿Cómo está la atmósfera en este momento?", "¿Se puede salir ahora mismo?"]
COND_EN = ["How's the weather now?", "Give me the current conditions", "Is it safe to do an EVA now?",
           "What do REMS and RAD say?", "How windy is it?", "Weather report please", "Is it cold outside?",
           "Any radiation risk today?", "Can we go out right now?"]
VERDICT_ES = {"go": "GO: se puede salir", "caution": "PRECAUCIÓN: se puede salir con cuidado",
              "no_go": "NO GO: no es seguro salir"}
VERDICT_EN = {"go": "GO: it is safe to go out", "caution": "CAUTION: you can go out carefully",
              "no_go": "NO GO: it is not safe to go out"}


CHECK_ES = {"cold": "temperatura", "wind": "viento", "dust": "polvo", "radiation": "radiación"}


def _label(c: dict, es: bool) -> str:
    word = c["label"].lower()
    return CHECK_ES.get(word, word) if es else word


def _source(c: dict) -> str:
    return c["source"].split(" (")[0].replace(" Climatology", "").split(" at ")[0]


def write_conditions(payloads: list[dict], lang: str) -> str:
    d = payloads[-1]["data"]
    es = lang == "es"
    checks = "; ".join(f"{_label(c, es)} {c['value']:g} {c['unit']}" for c in d["checks"])
    bad = [c for c in d["checks"] if c["verdict"] != "go"]
    head = (f"Sol {d['sol']}, {d['local_solar_time']}: {checks}." if es
            else f"Sol {d['sol']}, {d['local_solar_time']}: {checks}.")
    verdict = (VERDICT_ES if es else VERDICT_EN)[d["verdict"]]
    why = ""
    if bad:
        why = (" Lo que lo limita: " if es else " Limited by: ") + ", ".join(
            f"{_label(c, es)} ({c['value']:g} {c['unit']}, {_source(c)})" for c in bad) + "."
    note = (" Es la medición del sol actual, no un pronóstico." if es else " This is the current sol's reading, not a forecast.")
    return f"{head} Veredicto {verdict}.{why}{note}" if es else f"{head} Verdict {verdict}.{why}{note}"


# ---------- objetivos ----------

TARGETS_ES = ["¿Qué objetivos científicos hay?", "Lista los objetivos por prioridad", "¿Qué rocas son las más valiosas?",
              "¿Cuáles son los 3 mejores objetivos?", "¿Qué sitios tienen más prioridad?", "Muéstrame los objetivos"]
TARGETS_EN = ["Which science targets are there?", "List the targets by priority", "What are the top 3 targets?",
              "Which rocks matter most?", "Show me the targets"]
ONE_TARGET_ES = ["¿Qué se hace en {id}?", "Cuéntame sobre {name}", "¿Qué tarea hay en {id}?", "¿Qué es {name}?"]
ONE_TARGET_EN = ["What do we do at {id}?", "Tell me about {name}", "What's the task at {id}?"]


def write_targets(focus: str | None = None, top: int = 4):
    def write(payloads: list[dict], lang: str) -> str:
        items = payloads[-1]["data"]["targets_by_priority"]
        es = lang == "es"
        if focus:
            t = next(x for x in items if x["id"] == focus)
            task = (f"La tarea dura {t['task_min']:g} min." if es else f"The task takes {t['task_min']:g} min.")
            return (f"{t['name']} ({t['id']}), prioridad {t['priority']}/15, categoría {t['category']}. {t['description']} {task}"
                    if es else f"{t['name']} ({t['id']}), priority {t['priority']}/15, category {t['category']}. {t['description']} {task}")
        lines = [f"{i + 1}. {t['name'].split(' (')[0]} ({t['id']}): prioridad {t['priority']}/15, tarea de {t['task_min']:g} min"
                 if es else f"{i + 1}. {t['name'].split(' (')[0]} ({t['id']}): priority {t['priority']}/15, {t['task_min']:g} min task"
                 for i, t in enumerate(items[:top])]
        head = "Objetivos por prioridad:" if es else "Targets by priority:"
        tail = ("¿Quieres que prepare una salida con ellos?" if es else "Want me to plan an outing with them?")
        return head + "\n" + "\n".join(lines) + "\n" + tail
    return write


# ---------- plan en pantalla ----------

CUR_ES = {"oxygen": ["¿Con cuánto oxígeno terminan las caminatas?", "¿Cuánto O2 queda en la EVA?", "¿Alcanza el oxígeno?"],
          "battery": ["¿Cuánta batería le queda al rover al volver?", "¿Llega el rover con batería?"],
          "time": ["¿Cuánto dura todo el plan?", "¿Cuánto tiempo toma la salida?", "¿En cuánto tiempo terminamos?"],
          "route": ["¿Qué ruta tengo seleccionada?", "¿Qué perfil de ruta va a usar el rover?"],
          "targets": ["¿Qué objetivos tiene el plan actual?", "¿A dónde va la caminata?"]}
CUR_EN = {"oxygen": ["How much oxygen is left after the walks?", "Is there enough oxygen?"],
          "battery": ["How much battery does the rover come back with?"],
          "time": ["How long does the whole plan take?", "How much time is the outing?"],
          "route": ["Which route is selected for the rover?"],
          "targets": ["Which targets are in the current plan?"]}


def write_current(kind: str):
    def write(payloads: list[dict], lang: str) -> str:
        d = payloads[-1]["data"]
        es = lang == "es"
        if not d.get("has_plan", True) and "rover" not in d:
            return ("Todavía no hay rutas en pantalla. Si me dices cuánto tiempo tienes, preparo la salida."
                    if es else "There are no routes on screen yet. Tell me how much time you have and I will prepare the outing.")
        walks, rover = d.get("spacewalks", []), d.get("rover") or {}
        if kind == "oxygen" and walks:
            parts = ", ".join(f"{w['parking']} {w['oxygen_left_pct']:g}%" for w in walks)
            low = min(walks, key=lambda w: w["oxygen_left_pct"])
            safe = all(w["return_ok"] for w in walks)
            if es:
                return (f"Oxígeno al terminar cada caminata: {parts}. La más exigente es {low['parking']}"
                        + ("; todas vuelven con la reserva de seguridad." if safe else "; alguna no deja reserva suficiente."))
            return (f"Oxygen left after each walk: {parts}. The hardest one is {low['parking']}"
                    + ("; all keep the safety reserve." if safe else "; one does not keep enough reserve."))
        if kind == "battery" and rover:
            return (f"El rover vuelve a la base con {rover['battery_left_pct']:g}% de batería por la ruta {PROFILE_ES[rover['profile']]}."
                    if es else f"The rover gets back with {rover['battery_left_pct']:g}% battery on the {PROFILE_EN[rover['profile']]} route.")
        if kind == "time":
            return (f"El plan completo dura {d['total_duration_min']:g} min: rover {rover.get('duration_min', 0):g} min y "
                    + ", ".join(f"caminata en {w['parking']} {w['duration_min']:g} min" for w in walks) + "."
                    if es else f"The whole plan takes {d['total_duration_min']:g} min: rover {rover.get('duration_min', 0):g} min and "
                    + ", ".join(f"walk at {w['parking']} {w['duration_min']:g} min" for w in walks) + ".")
        if kind == "route" and rover:
            return (f"El rover usa la ruta {PROFILE_ES[rover['profile']]} ({rover['distance_m']:g} m, seguridad {rover['safety_pct']:g}%)."
                    if es else f"The rover uses the {PROFILE_EN[rover['profile']]} route ({rover['distance_m']:g} m, {rover['safety_pct']:g}% safety).")
        if kind == "targets" and walks:
            ids = [i for w in walks for i in w["targets"]]
            return (f"El plan visita {len(ids)} objetivos: " + ", ".join(ids) + "." if es
                    else f"The plan visits {len(ids)} targets: " + ", ".join(ids) + ".")
        return ""
    return write


def plan_summary(f: Factory, args: dict) -> dict[str, Any]:
    """Lo mismo que envía el frontend (useAssistant.planSummary) a partir de un plan real."""
    tools = f.tools(MissionContext())
    tools.execute(ToolCall("c", "plan_outing", args))
    o = tools.log.outing

    def leg(r):
        return {"profile": r.profile.value, "duration_min": round(r.duration_min, 1),
                "distance_m": round(r.distance_m), "safety_pct": r.safety_pct, "return_ok": r.return_ok}
    rover = o.chosen_traverse()
    return {
        "rover": {**leg(rover), "battery_left_pct": round(rover.resource.remaining_pct, 1)},
        "spacewalks": [{"parking": p.id, "targets": p.target_ids, **leg(r),
                        "oxygen_left_pct": round(r.resource.remaining_pct, 1)}
                       for p in o.traverse.parkings if (r := o.chosen_eva(p.id))],
        "total_duration_min": o.total_min,
    }


# ---------- vista ----------

VIEW_ES = [("Pon la ruta {p_es}", {"profile": "{p}"}), ("Cambia a la ruta {p_es}", {"profile": "{p}"}),
           ("Prefiero la ruta {p_es}", {"profile": "{p}"}), ("Mejor usa la {p_es}", {"profile": "{p}"}),
           ("Empieza la simulación", {"screen": "go"}), ("Arranca la misión", {"screen": "go"}),
           ("Vamos, lanza la simulación", {"screen": "go"}), ("Abre las caminatas", {"screen": "walk"}),
           ("Llévame a la pantalla de caminatas", {"screen": "walk"}), ("Vuelve a la ruta del rover", {"screen": "plan"}),
           ("Pon la {p_es} y empieza", {"profile": "{p}", "screen": "go"}),
           ("Selecciona la ruta {p_es}", {"profile": "{p}"}), ("Quiero ver la ruta {p_es}", {"profile": "{p}"}),
           ("Cámbiala a la {p_es}", {"profile": "{p}"}), ("Ve a la simulación", {"screen": "go"}),
           ("Empecemos la misión", {"screen": "go"}), ("Dale inicio a la simulación", {"screen": "go"}),
           ("Pasa a las caminatas", {"screen": "walk"}), ("Enséñame las caminatas", {"screen": "walk"}),
           ("Regresa a la pantalla del rover", {"screen": "plan"})]
VIEW_EN = [("Use the {p_en} route", {"profile": "{p}"}), ("Switch to the {p_en} route", {"profile": "{p}"}),
           ("Start the mission", {"screen": "go"}), ("Launch the simulation", {"screen": "go"}),
           ("Open the spacewalks", {"screen": "walk"}), ("Go back to the rover route", {"screen": "plan"}),
           ("Take the {p_en} route and start", {"profile": "{p}", "screen": "go"}),
           ("Select the {p_en} route", {"profile": "{p}"}), ("Show me the {p_en} route", {"profile": "{p}"}),
           ("Go to the simulation", {"screen": "go"}), ("Let's start the mission", {"screen": "go"}),
           ("Show the spacewalks", {"screen": "walk"}), ("Back to the rover screen", {"screen": "plan"})]
SCREEN_ES = {"go": "inicié la simulación", "walk": "abrí la pantalla de caminatas", "plan": "volví a la ruta del rover"}
SCREEN_EN = {"go": "started the simulation", "walk": "opened the spacewalks screen", "plan": "went back to the rover route"}


def write_view(payloads: list[dict], lang: str) -> str:
    p, es = payloads[-1], lang == "es"
    if p["error"]:
        return ("Todavía no hay un plan en pantalla. ¿Quieres que prepare la salida primero?" if es
                else "There is no plan on screen yet. Shall I prepare the outing first?")
    d = p["data"]
    parts = []
    if d["profile"]:
        parts.append(f"cambié a la ruta {PROFILE_ES[d['profile']]}" if es else f"switched to the {PROFILE_EN[d['profile']]} route")
    if d["screen"]:
        parts.append((SCREEN_ES if es else SCREEN_EN)[d["screen"]])
    return ("Listo: " + " y ".join(parts) + "." if es else "Done: " + " and ".join(parts) + ".")


# ---------- calendario ----------

LIST_ES = {"today": ["¿Qué tengo planeado para hoy?", "¿Qué planes hay hoy?", "¿Hay algún plan guardado para hoy?"],
           "tomorrow": ["¿Qué hay planeado para mañana?", "¿Tenemos plan para mañana?", "¿Qué haremos mañana?"],
           "all": ["Muéstrame todos los planes guardados", "¿Qué planes tenemos en el calendario?", "Lista mis planes"]}
LIST_EN = {"today": ["What's planned for today?", "Any plans saved for today?"],
           "tomorrow": ["What's planned for tomorrow?", "Do we have a plan for tomorrow?"],
           "all": ["Show me all saved plans", "What's in the mission calendar?"]}
SAVE_ES = {"today": [("Guarda este plan para hoy", False), ("Guárdalo para hoy como {title}", True), ("Deja este plan guardado para hoy", False),
                     ("Anota este plan en el calendario de hoy", False), ("Guárdame esto para hoy", False), ("Registra el plan de hoy", False),
                     ("Ponlo en el calendario de hoy como {title}", True)],
           "tomorrow": [("Guarda este plan para mañana", False), ("Guárdalo para mañana", False), ("Guárdalo para mañana con el nombre {title}", True),
                        ("Deja este plan para mañana", False), ("Agéndalo para mañana", False), ("Pásalo al calendario de mañana", False),
                        ("Resérvalo para mañana", False), ("Apúntalo para mañana como {title}", True), ("Esto es para mañana, guárdalo", False)]}
SAVE_EN = {"today": [("Save this plan for today", False), ("Save it for today as {title}", True), ("Put this in today's calendar", False),
                     ("Store this plan for today", False)],
           "tomorrow": [("Save this plan for tomorrow", False), ("Keep this plan for tomorrow", False), ("Save it for tomorrow as {title}", True),
                        ("Schedule this for tomorrow", False), ("Put this plan on tomorrow", False), ("This one is for tomorrow, save it", False)]}
OPEN_ES = {"today": ["Abre el plan de hoy", "Carga el plan de hoy", "Quiero ver el plan de hoy", "Pon en el mapa el plan de hoy",
                     "Recupera el plan que guardé para hoy", "Trae el plan de hoy"],
           "tomorrow": ["Abre el plan de mañana", "Carga el plan de mañana", "Muéstrame el plan de mañana en el mapa",
                        "Recupera el plan de mañana", "Trae el plan guardado para mañana", "Quiero revisar el plan de mañana"]}
OPEN_EN = {"today": ["Open today's plan", "Load today's plan", "Bring up the plan saved for today", "Show today's plan on the map"],
           "tomorrow": ["Open tomorrow's plan", "Load tomorrow's plan", "Bring up tomorrow's saved plan", "Let me review tomorrow's plan"]}
WHEN_ES = {"today": "hoy", "tomorrow": "mañana"}


def write_saved_list(f: "Factory"):
    def write(payloads: list[dict], lang: str) -> str:
        d, es = payloads[-1]["data"], lang == "es"
        when = d["day"]
        if not d["plans"]:
            if when == "all":
                return ("Todavía no hay planes guardados. Si me dices cuánto tiempo tienes, preparo uno."
                        if es else "There are no saved plans yet. Tell me how much time you have and I will prepare one.")
            return (f"No hay planes guardados para {WHEN_ES[when]}. ¿Quieres que prepare uno?" if es
                    else f"There are no plans saved for {when}. Shall I prepare one?")
        lines = []
        for p in d["plans"]:
            where = {"today": "hoy", "tomorrow": "mañana"}.get(p["when"], p["when"]) if es else p["when"]
            mins = f"{p['total_duration_min']:g} min" if p.get("total_duration_min") else ""
            lines.append(f"- {p['title']} ({where}, sol {p['sol']}): {', '.join(p['targets'])}"
                         + (f", {mins}" if mins else "") + (f", por {p['created_by']}" if es else f", by {p['created_by']}"))
        head = (f"Planes guardados ({len(d['plans'])}):" if es else f"Saved plans ({len(d['plans'])}):")
        tail = ("¿Abro alguno?" if es else "Shall I open one?")
        return head + "\n" + "\n".join(lines) + "\n" + tail
    return write


def write_save(payloads: list[dict], lang: str) -> str:
    p, es = payloads[-1], lang == "es"
    if p["error"]:
        return ("No hay ningún plan en pantalla para guardar. ¿Preparo uno primero?" if es
                else "There is no plan on screen to save. Shall I prepare one first?")
    d = p["data"]
    name = f" como «{d['title']}»" if (es and d.get("title")) else (f" as “{d['title']}”" if d.get("title") else "")
    return (f"Listo: guardé el plan{name} para {WHEN_ES[d['saved_for']]} (sol {d['sol']}). Lo verás en My plans." if es
            else f"Done: I saved the plan{name} for {d['saved_for']} (sol {d['sol']}). You will find it in My plans.")


def write_open(payloads: list[dict], lang: str) -> str:
    p, es = payloads[-1], lang == "es"
    if p["error"]:
        text = p["text"]
        if "Several plans" in text:
            names = [x.split(" = ", 1)[1] for x in text.split(": ", 1)[1].split("; ")]
            return ((f"Hay {len(names)} planes ese día: " + " y ".join(names) + ". ¿Cuál abro?") if es
                    else (f"There are {len(names)} plans that day: " + " and ".join(names) + ". Which one should I open?"))
        return ("No hay planes guardados para ese día. ¿Quieres que prepare uno?" if es
                else "There are no plans saved for that day. Shall I prepare one?")
    d = p["data"]
    mins = f", {d['total_duration_min']:g} min" if d.get("total_duration_min") else ""
    return (f"Abrí «{d['opened']}» (sol {d['sol']}{mins}). Ya está en el mapa." if es
            else f"I opened “{d['opened']}” (sol {d['sol']}{mins}). It is on the map now.")


# ---------- armado del conjunto ----------

PREFIX_ES = ["", "", "", "Oye, ", "Una pregunta: ", "Por favor, ", "Copiloto, "]
PREFIX_EN = ["", "", "", "Hey, ", "Quick question: ", "Please, "]


def with_prefix(rng: random.Random, text: str, es: bool) -> str:
    prefix = rng.choice(PREFIX_ES if es else PREFIX_EN)
    if not prefix:
        return text
    body = text if text.startswith("¿") else text[0].lower() + text[1:]
    return prefix + body


def build(seed: int, scale: float) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    f = Factory()
    eval_messages = {c["message"].lower() for c in json.loads(
        (ROOT.parent / "eval" / "cases.json").read_text(encoding="utf-8"))["cases"]}
    samples: list[dict[str, Any]] = []
    kinds: Counter = Counter()

    def add(kind: str, sample: dict | None, user: str) -> None:
        if sample is None or user.lower() in eval_messages:
            return
        sample["meta"] = {"kind": kind, "lang": reply_language(user)}
        samples.append(sample)
        kinds[kind] += 1

    n = lambda base: max(1, int(base * scale))  # noqa: E731
    variants = readiness_variants(f)

    # 1) Planificar (la habilidad principal)
    for _ in range(n(650)):
        lang = rng.choice(["es", "es", "en"])
        user, args = plan_order(rng, f, lang)
        user = with_prefix(rng, user, lang == "es")
        if reply_language(user) != ("Spanish" if lang == "es" else "English"):
            continue
        add("plan", conversation(f, user, [("plan_outing", args)], write_outing(f, user)), user)

    # 2) Planificar con mal tiempo: precaución o NO GO (no se planifica)
    for _ in range(n(90)):
        lang = rng.choice(["es", "en"])
        user, args = plan_order(rng, f, lang)
        assess = FixedReadiness(rng.choice(variants))
        add("plan_bad_weather", conversation(f, user, [("plan_outing", args)], write_outing(f, user), assess=assess), user)

    # 3) Clima
    for _ in range(n(160)):
        es = rng.random() < 0.65
        user = with_prefix(rng, rng.choice(COND_ES if es else COND_EN), es)
        assess = None if rng.random() < 0.5 else FixedReadiness(rng.choice(variants))
        add("conditions", conversation(f, user, [("get_mission_conditions", {})], write_conditions, assess=assess), user)

    # 4) Objetivos
    for _ in range(n(70)):
        es = rng.random() < 0.65
        user = with_prefix(rng, rng.choice(TARGETS_ES if es else TARGETS_EN), es)
        top = 3 if "3" in user else 4
        add("targets", conversation(f, user, [("list_science_targets", {})], write_targets(top=top)), user)
    for _ in range(n(60)):
        es = rng.random() < 0.65
        t = rng.choice(f.science)
        user = rng.choice(ONE_TARGET_ES if es else ONE_TARGET_EN).format(id=t.id, name=t.name.split(" (")[0])
        add("target_detail", conversation(f, user, [("list_science_targets", {})], write_targets(focus=t.id)), user)

    # 5) Plan en pantalla
    summaries = [plan_summary(f, a) for a in ({}, {"time_available_min": 120}, {"target_ids": ["T03"]},
                                              {"time_available_min": 180, "speed_factor": 0.7},
                                              {"target_ids": ["T05", "T06"], "profile": "fast"})]
    for _ in range(n(200)):
        es = rng.random() < 0.65
        kind = rng.choice(list(CUR_ES))
        user = with_prefix(rng, rng.choice(CUR_ES[kind] if es else CUR_EN[kind]), es)
        plan = rng.choice(summaries)
        ctx = MissionContext(goals=tuple(i for w in plan["spacewalks"] for i in w["targets"]),
                             has_plan=True, screen=rng.choice(["plan", "walk"]), plan=plan)
        add("current_plan", conversation(f, user, [("get_current_plan", {})], write_current(kind), context=ctx), user)
    for _ in range(n(30)):   # sin plan: lo dice y ofrece planificar
        es = rng.random() < 0.65
        kind = rng.choice(list(CUR_ES))
        user = rng.choice(CUR_ES[kind] if es else CUR_EN[kind])
        add("current_plan_empty", conversation(f, user, [("get_current_plan", {})], write_current(kind)), user)

    # 6) Cambiar la vista (con plan en pantalla) y sin plan (error explicado)
    for _ in range(n(320)):
        es = rng.random() < 0.65
        template, args = rng.choice(VIEW_ES if es else VIEW_EN)
        p = rng.choice(["safe", "scientific", "fast"])
        user = with_prefix(rng, template.format(p_es=PROFILE_ES[p], p_en=PROFILE_EN[p]), es)
        args = {k: v.format(p=p) for k, v in args.items()}
        has_plan = rng.random() < 0.88
        add("view" if has_plan else "view_no_plan",
            conversation(f, user, [("adjust_view", args)], write_view,
                         context=MissionContext(has_plan=has_plan, screen="walk" if has_plan else "plan")), user)

    # 7) Cómo usar / cómo funciona (explain_system)
    for entry in QA:
        for es in (True, False):
            questions = entry["es" if es else "en"]
            answer = entry["a_es" if es else "a_en"]
            for q in questions:
                for _ in range(max(1, int(3 * scale))):
                    user = with_prefix(rng, q, es)
                    add("explain:" + entry["topic"],
                        conversation(f, user, [("explain_system", {"topic": entry["topic"]})],
                                     lambda payloads, lang, a=answer: a), user)

    # 8) Temas ajenos: sin herramientas, rechazo amable
    for _ in range(n(90)):
        es = rng.random() < 0.6
        user = with_prefix(rng, rng.choice(OFF_TOPIC["es" if es else "en"]), es)
        answer = rng.choice(OFF_TOPIC["a_es" if reply_language(user) == "Spanish" else "a_en"])
        add("off_topic", conversation(f, user, [], lambda payloads, lang, a=answer: a), user)

    # 10) Calendario: ver, guardar y abrir planes
    for _ in range(n(120)):
        es = rng.random() < 0.65
        day = rng.choice(["today", "tomorrow", "all"])
        user = with_prefix(rng, rng.choice(LIST_ES[day] if es else LIST_EN[day]), es)
        empty = rng.random() < 0.25
        add("calendar_list", conversation(f, user, [("list_saved_plans", {"day": day})], write_saved_list(f),
                                          calendar=f.empty_calendar if empty else None), user)
    for _ in range(n(110)):
        es = rng.random() < 0.65
        day = rng.choice(["today", "tomorrow"])
        template, wants_title = rng.choice(SAVE_ES[day] if es else SAVE_EN[day])
        title = rng.choice(["Boxwork", "Plan B", "Ridge walk", "Ruta corta"]) if wants_title else None
        user = with_prefix(rng, template.format(title=title or ""), es)
        args = {"day": day, **({"title": title} if title else {})}
        has_plan = rng.random() < 0.88
        add("calendar_save" if has_plan else "calendar_save_no_plan",
            conversation(f, user, [("save_plan", args)], write_save,
                         context=MissionContext(has_plan=has_plan, screen="walk")), user)
    for _ in range(n(70)):
        es = rng.random() < 0.65
        day = rng.choice(["today", "tomorrow"])
        user = with_prefix(rng, rng.choice(OPEN_ES[day] if es else OPEN_EN[day]), es)
        add("calendar_open", conversation(f, user, [("open_saved_plan", {"day": day})], write_open), user)

    # 9) Conversaciones de varios turnos: planificar y luego ajustar o preguntar
    for _ in range(n(140)):
        lang = rng.choice(["es", "es", "en"])
        es = lang == "es"
        first, args = plan_order(rng, f, lang)
        if rng.random() < 0.5:
            template, vargs = rng.choice(VIEW_ES if es else VIEW_EN)
            p = rng.choice(["safe", "scientific", "fast"])
            user = template.format(p_es=PROFILE_ES[p], p_en=PROFILE_EN[p])
            vargs = {k: v.format(p=p) for k, v in vargs.items()}
            sample = conversation(f, user, [("adjust_view", vargs)], write_view,
                                  context=MissionContext(has_plan=True, screen="walk"), history=[first])
            add("multi_view", sample, user)
        else:
            kind = rng.choice(list(CUR_ES))
            user = rng.choice(CUR_ES[kind] if es else CUR_EN[kind])
            plan = plan_summary(f, args)
            ctx = MissionContext(has_plan=True, screen="walk", plan=plan,
                                 goals=tuple(i for w in plan["spacewalks"] for i in w["targets"]))
            add("multi_current", conversation(f, user, [("get_current_plan", {})], write_current(kind),
                                              context=ctx, history=[first]), user)
    print("ejemplos por tipo:", dict(kinds))
    return samples


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--scale", type=float, default=1.0, help="multiplica la cantidad de ejemplos")
    ap.add_argument("--val", type=float, default=0.08, help="fracción para validación")
    args = ap.parse_args()
    samples = build(args.seed, args.scale)
    # Sin duplicados exactos: repetir lo mismo enseña a memorizar, no a generalizar
    unique: dict[str, dict] = {}
    for s in samples:
        unique.setdefault(json.dumps(s["messages"][1:], ensure_ascii=False, sort_keys=True), s)
    print(f"duplicados descartados: {len(samples) - len(unique)}")
    samples = list(unique.values())
    rng = random.Random(args.seed)
    rng.shuffle(samples)
    cut = int(len(samples) * (1 - args.val))
    out = ROOT / "data"
    out.mkdir(exist_ok=True)
    for name, rows in (("train", samples[:cut]), ("val", samples[cut:])):
        with (out / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    stats = {"seed": args.seed, "total": len(samples), "train": cut, "val": len(samples) - cut,
             "by_kind": Counter(s["meta"]["kind"].split(":")[0] for s in samples),
             "by_lang": Counter(s["meta"]["lang"] for s in samples)}
    (out / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
