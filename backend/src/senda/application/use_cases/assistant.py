"""Caso de uso: dar órdenes al asistente de SENDA.

Bucle del agente: el modelo propone herramientas, se ejecutan contra los casos de
uso reales y sus resultados vuelven al modelo, hasta que responde sin pedir más
datos o se alcanza el límite de rondas. No depende de ningún proveedor de LLM."""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal, Protocol

from senda.application.assistant.conversation import (AssistantMessage, Message, ToolCall,
                                                      ToolResult, ToolResults, ToolSpec,
                                                      UserMessage)
from senda.application.assistant.language import reply_language
from senda.application.assistant.tools import PlanLog
from senda.application.ports.outbound import AssistantModel

MAX_TOOL_ROUNDS = 6
HISTORY_TURNS = 3          # órdenes recientes que ve el modelo
DONE_MARK = "(Done. The screen state below is current.)"

SYSTEM_PROMPT = """\
You are SENDA Copilot. You operate the SENDA mission-planning system for a crewed Mars \
mission at Gale crater. The user gives you an order; you carry it out with your tools and \
the result appears on their screen automatically. Act, do not ask for confirmation.

Tools:
- plan_outing: for any request to prepare, plan, organise or make a route, outing, EVA, \
traverse or mission, or where to go (also "tomorrow"). It checks the conditions itself, so \
call it directly. Pass the time the user has in minutes and the scenario (dust storm = \
speed_factor 0.7, suit leak = o2_multiplier 1.5). Pass target_ids only if the user names \
targets.
- adjust_view: to switch the route profile (safe, scientific, fast) or the screen (plan, \
walk, go = start the simulation) of the plan already on screen.
- get_mission_conditions: only when the user asks about the weather or conditions and does \
not ask for a plan.
- list_science_targets: questions about the targets or places.
- explain_system: any question about how SENDA works. Never explain from memory.

Rules:
- Every number, target and verdict you mention must come from a tool result. Never invent.
- If the verdict is no_go, say it first and name the measurement that causes it.
- Data is a snapshot of the current sol, not a forecast. For "tomorrow", say you used \
today's data.
- If a tool returns an error, say so in one sentence and adapt.
- Only help with SENDA and this Mars mission. Decline anything else in one sentence.

Reply after acting: 2 to 4 short sentences. Say what you loaded on screen (targets by name, \
total time, chosen profile and why), what was left out and why, and any warning. The map \
already shows the routes, so do not list coordinates or every figure.
"""


TOOL_REMINDER = (
    "Use your tools for my previous message: plan_outing or adjust_view for an order, "
    "explain_system for how SENDA works, get_mission_conditions or list_science_targets for "
    "data. If my previous message has nothing to do with SENDA or Mars, call no tool and "
    "just say so."
)


class AssistantTools(Protocol):
    specs: Sequence[ToolSpec]
    log: PlanLog

    def execute(self, call: ToolCall) -> ToolResult: ...

    def context_note(self) -> str: ...


@dataclass(frozen=True)
class ChatTurn:
    role: Literal["user", "assistant"]
    text: str


@dataclass(frozen=True)
class AssistantReply:
    text: str
    plans: PlanLog = field(default_factory=PlanLog)
    refused: bool = False
    truncated: bool = False


class ChatWithAssistant:
    def __init__(self, model: AssistantModel, tools: AssistantTools,
                 max_rounds: int = MAX_TOOL_ROUNDS) -> None:
        self._model = model
        self._tools = tools
        self._max_rounds = max_rounds

    def execute(self, history: Sequence[ChatTurn]) -> AssistantReply:
        if not history or history[-1].role != "user":
            raise ValueError("The conversation must end with a user message")
        system = _system_prompt(self._tools.context_note(), history[-1].text)
        messages = _compact(history)
        texts: list[str] = []
        first_answer: str | None = None   # respuesta sin herramientas, antes del recordatorio
        for _ in range(self._max_rounds):
            turn = self._model.next_turn(system, messages, self._tools.specs)
            if turn.refused:
                return AssistantReply(turn.text or _last(texts), self._tools.log, refused=True)
            if not turn.tool_calls and not self._tools.log.tools_used:
                if first_answer is None:
                    # Sin herramientas no hay acción: el modelo podría decir "hecho" sin
                    # hacerlo. Se le da una segunda oportunidad con un recordatorio.
                    first_answer = turn.text
                    messages.extend([turn, UserMessage(TOOL_REMINDER)])
                    continue
                # Sigue sin herramientas: era una respuesta directa (p. ej. rechazar un tema
                # ajeno). Vale la primera, que responde al usuario y no al recordatorio.
                return AssistantReply(first_answer or turn.text, self._tools.log)
            if turn.text:
                texts.append(turn.text)
            if not turn.tool_calls:
                return AssistantReply(_last(texts), self._tools.log)
            messages.append(turn)
            results = tuple(self._tools.execute(call) for call in turn.tool_calls)
            messages.append(ToolResults(results))
        return AssistantReply(_last(texts), self._tools.log, truncated=True)


def _compact(history: Sequence[ChatTurn]) -> list[Message]:
    """Últimas órdenes del usuario, con las respuestas anteriores reducidas a una marca.

    Medido con qwen3:1.7b: con las respuestas largas en el historial, el modelo las imita
    ("simulación iniciada") sin llamar a ninguna herramienta; con la marca, ejecuta la
    orden nueva. El estado actual no se pierde: llega en el prompt como estado de pantalla."""
    recent = list(history)[-(2 * HISTORY_TURNS - 1):]
    return [UserMessage(t.text) if t.role == "user" else AssistantMessage(DONE_MARK)
            for t in recent]


def _system_prompt(context: str, last_user_text: str) -> str:
    """Las instrucciones fijas más el estado de la pantalla y el idioma de la respuesta.

    Los modelos pequeños siguen mejor una orden explícita de idioma que una regla general."""
    language = reply_language(last_user_text)
    return (f"{SYSTEM_PROMPT}\n{context}\n"
            f"The user writes in {language}. Write your whole reply in {language}.")


def _last(texts: list[str]) -> str:
    """La respuesta final es el último texto del modelo (los intermedios son avisos de progreso)."""
    return texts[-1] if texts else ""
