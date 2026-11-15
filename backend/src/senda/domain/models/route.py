"""Entidades de planificación de rutas (EVA y rover)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

Cell = tuple[int, int]


class RouteProfile(str, Enum):
    SCIENTIFIC = "scientific"
    FAST = "fast"
    SAFE = "safe"


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
class RoutePlan:
    """Ruta EVA. `cells` es la ruta completa; `step_*` tienen len(cells) - 1."""
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
class TraversePlan:
    cells: list[Cell]
    metrics: TraverseMetrics
    elevation_m: list[float]
    cum_dist_m: list[float]
    reserve_kwh_min: float | None = None   # mínima reserva de drive-back a lo largo de la ida
