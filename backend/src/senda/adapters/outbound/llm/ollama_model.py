"""Adaptador del puerto AssistantModel para un modelo abierto servido por Ollama.

Funciona igual en local (laptop con GPU) o contra un servidor Ollama remoto gratuito
(Space de Hugging Face): basta cambiar la URL. Sirve el modelo base o el ajustado con LoRA.
Es el único módulo que conoce la API de Ollama; cambiar de motor solo toca este archivo."""
from __future__ import annotations

import json
import re
from collections.abc import Sequence
from typing import Any

import httpx

from senda.application.assistant.conversation import (AssistantMessage, Message, ToolCall,
                                                      ToolResults, ToolSpec, UserMessage)
from senda.domain.errors import AssistantUnavailable


class OllamaAssistantModel:
    def __init__(self, model: str, base_url: str = "http://localhost:11434",
                 context_tokens: int = 8192, token: str = "",
                 client: httpx.Client | None = None, think: bool | None = False) -> None:
        self._model = model
        # think=False pide respuestas directas (Ollama antepone un bloque <think> vacío).
        # None no envía el campo: es el formato con el que se entrenó senda-copilot.
        self._think = think
        self._context_tokens = context_tokens
        # token: para un servidor remoto protegido (p. ej. un Space privado de Hugging Face)
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = client or httpx.Client(base_url=base_url, headers=headers, timeout=180.0)

    def is_reachable(self) -> bool:
        """El servidor responde y tiene descargado el modelo configurado."""
        try:
            res = self._client.get("/api/tags", timeout=2.0)
        except httpx.HTTPError:
            return False
        if res.status_code != 200:
            return False
        names = {m.get("name") for m in res.json().get("models", [])}
        return self._model in names or f"{self._model}:latest" in names

    def next_turn(self, system: str, messages: Sequence[Message],
                  tools: Sequence[ToolSpec]) -> AssistantMessage:
        body = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, *_to_api(messages)],
            "tools": [{"type": "function",
                       "function": {"name": t.name, "description": t.description,
                                    "parameters": t.input_schema}} for t in tools],
            "stream": False,
            "options": {"temperature": 0.2, "num_ctx": self._context_tokens},
        }
        if self._think is not None:
            body["think"] = self._think
        try:
            res = self._client.post("/api/chat", json=body)
        except httpx.HTTPError as e:
            raise AssistantUnavailable("local model server (Ollama) is not reachable") from e
        if res.status_code != 200:
            raise AssistantUnavailable(f"Ollama error {res.status_code}: {res.text[:200]}")

        msg = res.json().get("message", {})
        text = (msg.get("content") or "").strip()
        raw_calls = [(c["function"]["name"], _arguments(c["function"].get("arguments")))
                     for c in msg.get("tool_calls") or []]
        if not raw_calls:
            found = _call_in_text(text, {t.name for t in tools})
            if found:
                raw_calls, text = [found], ""
        calls = tuple(ToolCall(f"call_{len(messages)}_{i}", name, args)
                      for i, (name, args) in enumerate(raw_calls))
        return AssistantMessage(text, calls)


def _arguments(raw: Any) -> dict[str, Any]:
    """Ollama devuelve un objeto; algunos modelos lo emiten como texto JSON."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


_TAGS = re.compile(r"</?\s*tool[_a-z]*\s*>", re.I)
_NAMED = re.compile(r"^\s*([a-z_]+)\s*(\{.*\})?\s*$", re.S)


def _call_in_text(text: str, names: set[str]) -> tuple[str, dict[str, Any]] | None:
    """Los modelos pequeños a veces escriben la llamada como texto en vez de usar la API:
    `<tool_call>{"name": ..., "arguments": ...}</tool_call>` (o `<tool>`, o el JSON solo)
    o `nombre {json}`. Solo se acepta si el texto es únicamente esa llamada y nombra una
    herramienta real; si no, el texto es la respuesta."""
    bare = _TAGS.sub("", text).strip()
    if bare.startswith("{"):
        body = _arguments(bare)
        name = body.get("name")
        return (name, _arguments(body.get("arguments"))) if name in names else None
    named = _NAMED.match(bare)
    if named and named.group(1) in names:
        return named.group(1), _arguments(named.group(2))
    return None


def _to_api(messages: Sequence[Message]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    names: dict[str, str] = {}   # id de llamada → herramienta (Ollama responde por nombre)
    for m in messages:
        if isinstance(m, UserMessage):
            out.append({"role": "user", "content": m.text})
        elif isinstance(m, AssistantMessage):
            entry: dict[str, Any] = {"role": "assistant", "content": m.text}
            if m.tool_calls:
                entry["tool_calls"] = [{"function": {"name": c.name, "arguments": c.arguments}}
                                       for c in m.tool_calls]
                names.update({c.id: c.name for c in m.tool_calls})
            out.append(entry)
        elif isinstance(m, ToolResults):
            for r in m.results:
                content = f"ERROR: {r.content}" if r.is_error else r.content
                out.append({"role": "tool", "tool_name": names.get(r.call_id, ""),
                            "content": content})
    return out
