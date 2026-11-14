"""Entidades de planificación de rutas (rover y EVA)."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from senda.domain.models.geo import GeoPoint


class RouteProfile(str, Enum):
    SCIENTIFIC = "scientific"   # pasa cerca de los objetivos con el menor desvío
    FAST = "fast"               # minimiza el tiempo
    SAFE = "safe"               # evita pendientes y peligros


class TravelMode(str, Enum):
    ROVER = "rover"
    EVA = "eva"


class StopKind(str, Enum):
    BASE = "base"
    PARKING = "parking"
    TARGET = "target"
    ROVER = "rover"
    WAYPOINT = "waypoint"


@dataclass(frozen=True)
class Hazard:
    """Zona circular que no se puede cruzar (marcada por el usuario o por una contingencia)."""
    center: GeoPoint
    radius_m: float


@dataclass(frozen=True)
class Conditions:
    """Modificadores del escenario simulado (tormenta de polvo, fuga en el traje...)."""
    speed_factor: float = 1.0
    o2_multiplier: float = 1.0


@dataclass(frozen=True)
class Waypoint:
    location: GeoPoint
    kind: StopKind
    ref_id: str = ""
    dwell_min: float = 0.0   # tiempo detenido al llegar (tarea científica)


@dataclass(frozen=True)
class RoutePoint:
    """Vértice del camino con valores de desplazamiento acumulados desde el inicio
    (sin incluir el tiempo ni el consumo de las tareas en las paradas)."""
    location: GeoPoint
    elevation_m: float
    slope_deg: float
    distance_m: float
    time_min: float
    resource_used: float


@dataclass(frozen=True)
class RouteStop:
    point_index: int
    kind: StopKind
    ref_id: str
    dwell_min: float
    dwell_resource: float = 0.0


@dataclass(frozen=True)
class Resource:
    name: str          # "battery" | "oxygen"
    unit: str          # "kWh" | "L"
    used: float
    capacity: float

    @property
    def remaining_pct(self) -> float:
        return max(0.0, 100.0 * (1 - self.used / self.capacity))


@dataclass(frozen=True)
class RoutePlan:
    mode: TravelMode
    profile: RouteProfile
    points: list[RoutePoint]
    stops: list[RouteStop]
    distance_m: float
    duration_min: float
    max_slope_deg: float
    obstacles: int
    safety_pct: float
    resource: Resource
    return_ok: bool


@dataclass(frozen=True)
class ParkingSpot:
    id: str
    location: GeoPoint
    target_ids: list[str]


@dataclass(frozen=True)
class TraversePlan:
    parkings: list[ParkingSpot]
    routes: list[RoutePlan]
