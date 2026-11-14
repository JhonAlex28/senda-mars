"""Entidades de planificación de rutas."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from senda.domain.models.geo import GeoPoint


class RouteProfile(str, Enum):
    SCIENTIFIC = "scientific"
    FAST = "fast"
    SAFE = "safe"


@dataclass(frozen=True)
class RoutePlan:
    profile: RouteProfile
    path: list[GeoPoint]
    distance_m: float
    duration_min: float
    o2_liters: float
    dose_msv: float
