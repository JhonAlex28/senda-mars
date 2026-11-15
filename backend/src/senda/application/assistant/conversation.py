"""Modelo neutral de conversación entre el caso de uso y cualquier LLM.

Ningún tipo de aquí conoce a un proveedor concreto: el adaptador de salida
traduce estos objetos al formato de su API (y guarda en `raw` lo que necesite
reenviar tal cual dentro del mismo bucle de herramientas)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Union


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolResult:
    call_id: str
    content: str
    is_error: bool = False


@dataclass(frozen=True)
class UserMessage:
    text: str


@dataclass(frozen=True)
class AssistantMessage:
    text: str
    tool_calls: tuple[ToolCall, ...] = ()
    refused: bool = False
    # Contenido original del proveedor (p. ej. bloques de razonamiento) para reenviarlo intacto
    raw: Any = field(default=None, compare=False, repr=False)


@dataclass(frozen=True)
class ToolResults:
    results: tuple[ToolResult, ...]


Message = Union[UserMessage, AssistantMessage, ToolResults]
