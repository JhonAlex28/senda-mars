"""Respaldo entre servidores del modelo: laptop (túnel) primero, Space de Hugging Face después."""
import pytest

from senda.adapters.outbound.llm.fallback_model import FallbackAssistantModel
from senda.application.assistant.conversation import AssistantMessage
from senda.domain.errors import AssistantUnavailable


class _Server:
    def __init__(self, reachable: bool = True, fails: bool = False, wakes: bool = False):
        self.reachable, self.fails = reachable, fails
        self.checks = self.calls = self.woken = 0
        if wakes:
            self.wake = self._wake

    def _wake(self):
        self.woken += 1

    def is_reachable(self) -> bool:
        self.checks += 1
        return self.reachable

    def next_turn(self, system, messages, tools) -> AssistantMessage:
        self.calls += 1
        if self.fails:
            raise AssistantUnavailable("down")
        return AssistantMessage(f"from {id(self)}")


class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self) -> float:
        return self.t


def test_uses_the_laptop_when_it_is_on():
    laptop, space = _Server(), _Server()
    model = FallbackAssistantModel([("primary", laptop), ("fallback", space)])
    model.next_turn("s", [], [])
    assert laptop.calls == 1 and space.calls == 0 and model.last_used == "primary"


def test_laptop_off_goes_to_the_space_without_calling_the_laptop():
    laptop, space = _Server(reachable=False), _Server(reachable=False)
    model = FallbackAssistantModel([("primary", laptop), ("fallback", space)])
    model.next_turn("s", [], [])
    # el Space no se comprueba antes (puede estar dormido): se le llama directamente
    assert laptop.calls == 0 and space.checks == 0 and space.calls == 1
    assert model.last_used == "fallback"


def test_the_laptop_check_is_remembered_for_a_while():
    clock = _Clock()
    laptop, space = _Server(reachable=False), _Server()
    model = FallbackAssistantModel([("primary", laptop), ("fallback", space)], recheck_s=60, clock=clock)
    model.next_turn("s", [], [])
    model.next_turn("s", [], [])
    assert laptop.checks == 1                 # no hace esperar 2 s en cada turno
    laptop.reachable, clock.t = True, 61.0    # la laptop se enciende: pasado el minuto se vuelve a ella
    model.next_turn("s", [], [])
    assert laptop.checks == 2 and laptop.calls == 1


def test_a_failure_mid_conversation_switches_to_the_space():
    laptop, space = _Server(fails=True), _Server()
    model = FallbackAssistantModel([("primary", laptop), ("fallback", space)])
    model.next_turn("s", [], [])
    assert laptop.calls == 1 and space.calls == 1 and model.last_used == "fallback"


def test_both_down_reports_unavailable():
    model = FallbackAssistantModel([("primary", _Server(fails=True)), ("fallback", _Server(fails=True))])
    with pytest.raises(AssistantUnavailable):
        model.next_turn("s", [], [])


def test_status_wakes_a_sleeping_space_and_reports_it_available():
    laptop, space = _Server(reachable=False), _Server(reachable=False, wakes=True)
    model = FallbackAssistantModel([("primary", laptop), ("fallback", space)])
    assert model.is_reachable() and space.woken == 1
