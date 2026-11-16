"""Varios servidores del mismo modelo, en orden de preferencia (p. ej. la laptop por un túnel y,
si está apagada, un Space de Hugging Face). Implementa el mismo puerto AssistantModel, así que el
resto de la aplicación no sabe cuántos servidores hay detrás.

Antes de usar un servidor que no es el último se comprueba rápido que responde (2 s), y el
resultado se recuerda un rato: así una laptop apagada no hace esperar al usuario en cada turno.
El último servidor no se comprueba antes: un Space dormido tarda en despertar y la comprobación
rápida lo descartaría; se le llama directamente y el tiempo de espera largo cubre el arranque."""
from __future__ import annotations

import logging
import time
from collections.abc import Callable, Sequence

from senda.application.assistant.conversation import AssistantMessage, Message, ToolSpec
from senda.application.ports.outbound import AssistantModel
from senda.domain.errors import AssistantUnavailable

log = logging.getLogger(__name__)


class FallbackAssistantModel:
    def __init__(self, servers: Sequence[tuple[str, AssistantModel]], recheck_s: float = 60.0,
                 clock: Callable[[], float] = time.monotonic) -> None:
        if not servers:
            raise ValueError("at least one model server is required")
        self._servers = list(servers)
        self._recheck_s = recheck_s
        self._clock = clock
        self._checked: dict[str, tuple[bool, float]] = {}   # nombre → (responde, cuándo se vio)
        self.last_used: str | None = None                    # para el estado en la interfaz

    def _usable(self, name: str, model: AssistantModel) -> bool:
        seen = self._checked.get(name)
        now = self._clock()
        if seen and now - seen[1] < self._recheck_s:
            return seen[0]
        ok = model.is_reachable()
        self._checked[name] = (ok, now)
        return ok

    def next_turn(self, system: str, messages: Sequence[Message],
                  tools: Sequence[ToolSpec]) -> AssistantMessage:
        last_error: AssistantUnavailable | None = None
        for i, (name, model) in enumerate(self._servers):
            is_last = i == len(self._servers) - 1
            if not is_last and not self._usable(name, model):
                continue
            try:
                reply = model.next_turn(system, messages, tools)
            except AssistantUnavailable as e:
                log.warning("model server %s failed, trying the next one: %s", name, e)
                self._checked[name] = (False, self._clock())
                last_error = e
                continue
            self.last_used = name
            return reply
        raise last_error or AssistantUnavailable("no model server is reachable")

    def is_reachable(self) -> bool:
        # Sin caché: lo usa el estado de la interfaz y conviene que sea el dato real
        for name, model in self._servers:
            ok = model.is_reachable()
            self._checked[name] = (ok, self._clock())
            if ok:
                return True
        # Nadie responde ya, pero el último puede estar dormido (Space gratuito): se le despierta
        # en segundo plano y se da por disponible; si de verdad está caído, el chat lo dirá.
        wake = getattr(self._servers[-1][1], "wake", None)
        if wake is None:
            return False
        wake()
        return True
