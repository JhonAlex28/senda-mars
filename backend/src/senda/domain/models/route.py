"""Entidades de planificación de rutas (rover y EVA).

Dos familias:
  - Contrato con el frontend (RoutePlan, TraversePlan, RoutePoint, RouteStop, Resource…):
    la forma que consumen /routes/traverse, /routes/eva y /routes/path.
  - Resultado interno del motor (EvaRoute, RoverRoute): celdas + métricas físicas
    (Pandolf, energía del rover, campo de retorno, PNR). Un mapper traduce de uno a otro.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from senda.domain.models.geo import GeoPoint

Cell = tuple[int, int]


class RouteProfile(str, Enum):
    SCIENTIFIC = "scientific"   # pasa cerca de los objetivos con el menor desvío
    FAST = "fast"               # minimiza la energía
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


# ---------------------------------------------------------------------------
# Contrato con el frontend
# ---------------------------------------------------------------------------
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
    # Campos adicionales del motor de Mec. B (opcionales para el frontend)
    pnr_index: int | None = None
    reserve_min: float | None = None          # reserva mínima de retorno (L o kWh)
    infeasible_reasons: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ParkingSpot:
    id: str
    location: GeoPoint
    target_ids: list[str]


@dataclass(frozen=True)
class TraversePlan:
    parkings: list[ParkingSpot]
    routes: list[RoutePlan]


# ---------------------------------------------------------------------------
# Resultado interno del motor
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Stop:
    target_id: str
    path_index: int
    task_min: float
    energy_kj: float
    shielding_pct: float = 0.0


@dataclass(frozen=True)
class Segment:
    from_id: str
    to_id: str
    start_index: int
    end_index: int
    dist_m: float
    energy: float          # kJ (EVA) o kWh (rover)
    time_min: float
    o2_l: float = 0.0


@dataclass(frozen=True)
class RouteMetrics:
    dist_m: float
    ascent_m: float
    descent_m: float
    max_slope_deg: float
    energy_kj: float
    o2_l: float
    time_min: float
    walk_time_min: float
    dose_msv: float
    science_score: float
    o2_margin_at_end: float       # fracción del tanque que queda al final
    feasible: bool


@dataclass(frozen=True)
class EvaRoute:
    """Ruta EVA del motor. `cells` es la ruta completa; `step_*` tienen len(cells) - 1."""
    profile: RouteProfile
    cells: list[Cell]
    metrics: RouteMetrics
    segments: list[Segment]
    stops: list[Stop]
    step_energy_kj: list[float]
    step_time_s: list[float]
    elevation_m: list[float]
    cum_dist_m: list[float]
    pnr_index: int | None
    infeasible_reasons: list[str] = field(default_factory=list)
    reserve_l: list[float] = field(default_factory=list)
    waypoint_index: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class TraverseMetrics:
    dist_m: float
    ascent_m: float
    max_slope_deg: float
    energy_kwh: float
    battery_used_pct: float
    time_min: float
    feasible: bool


@dataclass(frozen=True)
class RoverRoute:
    cells: list[Cell]
    metrics: TraverseMetrics
    elevation_m: list[float]
    cum_dist_m: list[float]
    reserve_kwh_min: float | None = None   # mínima reserva de drive-back a lo largo del tramo
    step_energy_kwh: list[float] = field(default_factory=list)
    step_time_s: list[float] = field(default_factory=list)
    waypoint_index: list[int] = field(default_factory=list)
