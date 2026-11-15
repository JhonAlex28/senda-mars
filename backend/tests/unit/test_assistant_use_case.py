"""El bucle del agente, probado con un modelo y herramientas falsos (sin red ni costo)."""
import pytest

from senda.application.assistant.conversation import (AssistantMessage, ToolCall, ToolResult,
                                                      ToolResults, ToolSpec)
from senda.application.assistant.tools import PlanLog
from senda.application.use_cases.assistant import ChatTurn, ChatWithAssistant


class ScriptedModel:
    """Adaptador falso del puerto AssistantModel: devuelve turnos predefinidos."""

    def __init__(self, *turns):
        self._turns = list(turns)
        self.seen = []

    def next_turn(self, system, messages, tools):
        self.seen.append(list(messages))
        return self._turns.pop(0)


class EchoTools:
    specs = (ToolSpec("ping", "test", {"type": "object", "properties": {}}),)

    def __init__(self):
        self.log = PlanLog()

    def execute(self, call):
        self.log.tools_used.append(call.name)
        return ToolResult(call.id, f"pong:{call.arguments.get('n')}")

    def context_note(self):
        return "Current screen: selected targets: T03."


ASK = [ChatTurn("user", "plan my EVA")]


def test_runs_tools_and_returns_final_answer():
    model = ScriptedModel(
        AssistantMessage("checking", (ToolCall("c1", "ping", {"n": 1}),
                                      ToolCall("c2", "ping", {"n": 2}))),
        AssistantMessage("Done: go to T03."),
    )
    reply = ChatWithAssistant(model, EchoTools()).execute(ASK)

    assert reply.text == "Done: go to T03."
    assert reply.plans.tools_used == ["ping", "ping"]
    # Las dos llamadas paralelas vuelven juntas en un solo mensaje de resultados
    results = model.seen[1][-1]
    assert isinstance(results, ToolResults)
    assert [r.content for r in results.results] == ["pong:1", "pong:2"]


def test_stops_after_max_rounds():
    looping = [AssistantMessage("", (ToolCall(f"c{i}", "ping", {}),)) for i in range(3)]
    reply = ChatWithAssistant(ScriptedModel(*looping), EchoTools(), max_rounds=3).execute(ASK)
    assert reply.truncated
    assert reply.plans.tools_used == ["ping"] * 3


def test_refusal_is_reported():
    reply = ChatWithAssistant(ScriptedModel(AssistantMessage("", refused=True)),
                              EchoTools()).execute(ASK)
    assert reply.refused and reply.text == ""


def test_history_must_end_with_user():
    with pytest.raises(ValueError):
        ChatWithAssistant(ScriptedModel(), EchoTools()).execute([ChatTurn("assistant", "hi")])


class RecordingModel:
    def __init__(self):
        self.system = ""

    def next_turn(self, system, messages, tools):
        self.system = system
        return AssistantMessage("ok")


def test_system_prompt_carries_screen_state_and_reply_language():
    model = RecordingModel()
    ChatWithAssistant(model, EchoTools()).execute([ChatTurn("user", "Hazme una ruta para mañana")])
    assert "selected targets: T03" in model.system
    assert model.system.endswith("Write your whole reply in Spanish.")
    ChatWithAssistant(model, EchoTools()).execute([ChatTurn("user", "Which targets should we visit?")])
    assert model.system.endswith("Write your whole reply in English.")


def test_reply_without_tools_gets_one_reminder_to_act():
    model = ScriptedModel(
        AssistantMessage("Simulation started."),             # dice que lo hizo, sin hacerlo
        AssistantMessage("", (ToolCall("c1", "ping", {}),)),
        AssistantMessage("Started."),
    )
    reply = ChatWithAssistant(model, EchoTools()).execute(ASK)
    assert reply.text == "Started." and reply.plans.tools_used == ["ping"]
    assert "Use your tools" in model.seen[1][-1].text   # el recordatorio llegó al modelo


def test_off_topic_answer_survives_the_reminder():
    model = ScriptedModel(AssistantMessage("I only help with SENDA."), AssistantMessage("Call the tool."))
    reply = ChatWithAssistant(model, EchoTools()).execute([ChatTurn("user", "Capital of France?")])
    assert reply.text == "I only help with SENDA." and reply.plans.tools_used == []


def test_history_is_compacted_to_recent_orders():
    model = ScriptedModel(AssistantMessage("", (ToolCall("c1", "ping", {}),)),
                          AssistantMessage("ok"))
    long_answer = "Plan loaded: T05, T06... " * 20
    history = [t for i in range(5) for t in (ChatTurn("user", f"order {i}"),
                                             ChatTurn("assistant", long_answer))]
    ChatWithAssistant(model, EchoTools()).execute([*history, ChatTurn("user", "start")])
    sent = model.seen[0]
    assert len(sent) == 5 and sent[-1].text == "start"
    assert all(long_answer not in m.text for m in sent)
