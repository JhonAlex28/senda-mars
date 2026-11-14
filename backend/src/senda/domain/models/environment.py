"""Entidad: condiciones ambientales del sol de la EVA."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class EnvironmentSnapshot:
    sol: int
    ls_deg: float
    local_solar_time: str
    pressure_pa: float
    temp_min_c: float
    temp_max_c: float
    # Bloques aún no modelados como dominio (radiación, polvo, fisiología...)
    details: dict[str, Any] = field(default_factory=dict)
