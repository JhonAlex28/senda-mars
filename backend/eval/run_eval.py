"""Examen automático del copiloto de SENDA.

Corre cada caso de eval/cases.json contra el agente real (mismo caso de uso, herramientas y
planificador que la app) y un modelo servido por Ollama, y califica:

  routing     llamó a la herramienta esperada (o a ninguna, en temas ajenos)
  args        entendió los datos de la orden (tiempo, tormenta, objetivos, perfil, tema)
  language    respondió en el idioma del usuario
  grounded    los números de la respuesta salen de los resultados de las herramientas

Uso (desde backend/, con Ollama encendido):
    python eval/run_eval.py                       # modelo de SENDA_LLM_MODEL o backend/.env
    python eval/run_eval.py --model senda-copilot # comparar con el modelo ajustado
    python eval/run_eval.py --only plan,view      # solo algunas categorías

Guarda el detalle en eval/results/<modelo>-<fecha>.json para comparar antes / después.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "src"))

from senda.adapters.inbound.http.schemas import MissionIn  # noqa: E402
from senda.adapters.outbound.llm.ollama_model import OllamaAssistantModel  # noqa: E402
from senda.application.assistant.conversation import ToolCall, ToolResult  # noqa: E402
from senda.application.assistant.language import reply_language  # noqa: E402
from senda.application.assistant.tools import MissionTools  # noqa: E402
from senda.application.use_cases.assistant import ChatTurn, ChatWithAssistant  # noqa: E402
from senda.adapters.outbound.persistence.sql_store import CrewStore, SqlMissionStore  # noqa: E402
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment  # noqa: E402
from senda.application.use_cases.mission_log import CrewRoster, MissionCalendar  # noqa: E402
from senda.application.use_cases.plan_outing import PlanOuting  # noqa: E402
from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse  # noqa: E402
from senda.application.use_cases.targets import ListTargets  # noqa: E402
from senda.container import get_container  # noqa: E402

CHECKS = ("routing", "args", "language", "grounded")


@dataclass
class Recorded:
    """Herramientas que llamó el modelo, con sus argumentos y resultados."""
    calls: list[ToolCall] = field(default_factory=list)
    results: list[ToolResult] = field(default_factory=list)


class RecordingTools(MissionTools):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.recorded = Recorded()

    def execute(self, call: ToolCall) -> ToolResult:
        result = super().execute(call)
        self.recorded.calls.append(call)
        self.recorded.results.append(result)
        return result


_CALENDAR: tuple[MissionCalendar, CrewRoster] | None = None


def exam_calendar() -> tuple[MissionCalendar, CrewRoster]:
    """Calendario de examen (base de datos temporal): un plan hoy y otro mañana."""
    global _CALENDAR
    if _CALENDAR is None:
        db = Path(tempfile.mkdtemp(prefix="senda-eval-")) / "exam.db"
        store = SqlMissionStore(f"sqlite:///{db.as_posix()}")
        cal = MissionCalendar(store, get_container().environment_repo)
        for title, day, targets in (("Boxwork drill run", "today", ["T05", "T06"]),
                                    ("Altadena and the ridge", "tomorrow", ["T02", "T04"])):
            cal.save(title=title, day=day, site_id="mount-sharp", created_by="EVA-1",
                     summary={"targets": targets, "total_duration_min": 100.0}, payload={})
        _CALENDAR = (cal, CrewRoster(CrewStore(store)))
    return _CALENDAR


def build_tools(mission: dict[str, Any]) -> RecordingTools:
    c = get_container()
    calendar, crew = exam_calendar()
    assess, targets = AssessReadiness(c.environment_repo), ListTargets(c.target_repo)
    outing = PlanOuting(assess, targets, PlanTraverse(c.planner),
                        PlanEva(c.planner))
    context = MissionIn(**mission).to_context()
    return RecordingTools(assess, GetEnvironment(c.environment_repo), targets, outing,
                          c.knowledge, context, calendar, crew)


# ---------- calificación ----------

def check_routing(expect: dict[str, Any], rec: Recorded) -> bool:
    names = [c.name for c in rec.calls]
    if expect.get("no_tools"):
        return not names
    wanted = expect.get("tool_any") or [expect["tool"]]
    return any(n in wanted for n in names)


def _close(a: Any, b: Any) -> bool:
    try:
        return abs(float(a) - float(b)) <= max(0.1, 0.1 * abs(float(b)))
    except (TypeError, ValueError):
        return False


def check_args(expect: dict[str, Any], rec: Recorded) -> bool | None:
    wanted = expect.get("args")
    if not wanted:
        return None   # el caso no pide argumentos concretos
    tool = expect.get("tool")
    calls = [c for c in rec.calls if c.name == tool]
    for call in calls:
        a = call.arguments
        ok = True
        for key, value in wanted.items():
            got = a.get(key)
            if key == "target_ids":
                got_ids = {str(x).split()[0] for x in (got or [])}
                ok &= set(value) <= got_ids
            elif key in ("profile", "topic", "day"):
                ok &= str(got).lower() == value
            elif key == "screen":
                ok &= value in {str(a.get("screen")).lower(), str(a.get("profile")).lower()}
            else:
                ok &= _close(got, value)
        if ok:
            return True
    return False


def _without_names(text: str) -> str:
    """Los nombres de los objetivos ("Valle de la Luna") no deben decidir el idioma detectado."""
    for t in get_container().target_repo.list_all():
        text = text.replace(t.name, " ").replace(t.name.split(" (")[0], " ")
    return text


def check_language(message: str, reply: str) -> bool:
    return not reply or reply_language(_without_names(reply)) == reply_language(message)


_NUMBER = re.compile(r"(?<![\w.])-?\d+(?:[.,]\d+)?")


def numbers_in(text: str) -> list[str]:
    return [n.replace(",", ".") for n in _NUMBER.findall(text.replace("\u2212", "-"))]


def check_grounded(reply: str, rec: Recorded, message: str) -> bool | None:
    """Cada número de 2+ cifras de la respuesta debe aparecer en algún resultado de herramienta
    (o en la propia pregunta). Aproximación: tolera redondeos de ±1 en la última cifra."""
    numbers = [n for n in numbers_in(reply) if len(n.strip("-").replace(".", "")) >= 2]
    if not numbers:
        return None
    source = " ".join(r.content for r in rec.results) + " " + message
    known = [float(x) for x in numbers_in(source)]
    known += [k * 60 for k in known if k < 24] + [k / 60 for k in known]   # horas ↔ minutos
    known += [k * 100 for k in known if 0 < abs(k) <= 1]                   # 0.7 → 70 %
    return all(any(abs(float(n) - k) <= 1.0 for k in known) for n in numbers)


# ---------- ejecución ----------

def run(model_name: str, only: set[str] | None, url: str, think: bool | None = False) -> dict[str, Any]:
    spec = json.loads((ROOT / "cases.json").read_text(encoding="utf-8"))
    settings = get_container().settings
    model = OllamaAssistantModel(model_name, url, settings.llm_context_tokens, settings.ollama_token,
                                 think=think)
    if not model.is_reachable():
        sys.exit(f"Ollama no responde en {url} o el modelo '{model_name}' no está descargado.")

    rows = []
    for case in spec["cases"]:
        if only and case["category"] not in only:
            continue
        mission = dict(case.get("mission", {}))
        if mission.get("plan") == "plan_on_screen":
            mission["plan"] = spec["plan_on_screen"]
        tools = build_tools(mission)
        history = [ChatTurn(t["role"], t["text"]) for t in case.get("history", [])]
        history.append(ChatTurn("user", case["message"]))
        t0 = time.perf_counter()
        reply = ChatWithAssistant(model, tools).execute(history)
        seconds = round(time.perf_counter() - t0, 1)
        rec, expect = tools.recorded, case["expect"]
        scores = {
            "routing": check_routing(expect, rec),
            "args": check_args(expect, rec),
            "language": check_language(case["message"], reply.text),
            "grounded": check_grounded(reply.text, rec, case["message"]),
        }
        rows.append({"id": case["id"], "category": case["category"], "message": case["message"],
                     "seconds": seconds, "scores": scores,
                     "tools": [{"name": c.name, "args": c.arguments} for c in rec.calls],
                     "reply": reply.text})
        flags = " ".join(f"{k}={'·' if v is None else ('OK' if v else 'X')}" for k, v in scores.items())
        print(f"{case['id']:<12} {seconds:>5}s  {flags}  {[c.name for c in rec.calls]}", flush=True)
    return {"model": model_name, "date": datetime.now().isoformat(timespec="seconds"),
            "summary": summarize(rows), "cases": rows}


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    def rate(values: list[bool | None]) -> float | None:
        graded = [v for v in values if v is not None]
        return round(100 * sum(graded) / len(graded), 1) if graded else None

    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r)
    overall = {k: rate([r["scores"][k] for r in rows]) for k in CHECKS}
    perfect = [all(v is not False for v in r["scores"].values()) for r in rows]
    return {
        "cases": len(rows),
        "all_checks_pass_pct": rate(perfect),
        "overall": overall,
        "by_category": {c: {k: rate([r["scores"][k] for r in rs]) for k in CHECKS}
                        for c, rs in sorted(by_cat.items())},
        "avg_seconds": round(sum(r["seconds"] for r in rows) / max(1, len(rows)), 1),
    }


def main() -> None:
    settings = get_container().settings
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=settings.llm_model)
    ap.add_argument("--url", default=settings.ollama_url)
    ap.add_argument("--only", help="categorías separadas por coma")
    ap.add_argument("--think", choices=["false", "true", "auto"], default="false",
                    help="auto = no enviar el campo think a Ollama")
    args = ap.parse_args()
    think = None if args.think == "auto" else args.think == "true"
    report = run(args.model, set(args.only.split(",")) if args.only else None, args.url, think)

    s = report["summary"]
    print(f"\n== {args.model}: {s['cases']} casos · todo correcto en {s['all_checks_pass_pct']}% · "
          f"{s['avg_seconds']} s de media")
    print(f"   {'':<14}" + "".join(f"{k:>10}" for k in CHECKS))
    for cat, sc in [("TOTAL", s["overall"]), *s["by_category"].items()]:
        print(f"   {cat:<14}" + "".join(f"{('—' if sc[k] is None else f'{sc[k]:.0f}%'):>10}" for k in CHECKS))

    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    tag = "" if args.think == "false" else f"-think-{args.think}"
    name = f"{args.model.replace(':', '-').replace('/', '-')}{tag}-{datetime.now():%Y%m%d-%H%M}.json"
    (out / name).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nDetalle: eval/results/{name}")


if __name__ == "__main__":
    main()
