"""Plan de misión completo: rover (ida) + EVA + rover (vuelta) + timeline por sol."""
from __future__ import annotations

from dataclasses import dataclass, field

from senda.domain.models.route import EvaRoute, RouteProfile, RoverRoute
from senda.domain.models.terrain import TerrainGrid


@dataclass(frozen=True)
class SolActivity:
    sol: int
    start_h: float      # hora LTST (0–24)
    end_h: float
    activity: str       # drive_out | overnight | egress | eva | ingress | drive_back
    profile: RouteProfile | None = None


@dataclass(frozen=True)
class Warning:
    code: str
    msg: str


@dataclass(frozen=True)
class MissionPlan:
    base_lonlat: tuple[float, float]
    staging_id: str
    staging_lonlat: tuple[float, float]
    traverse_out: RoverRoute
    traverse_back: RoverRoute
    eva_routes: list[EvaRoute]
    timeline_profile: RouteProfile
    timeline: list[SolActivity]
    feasible: bool
    warnings: list[Warning] = field(default_factory=list)
    eva_grid: TerrainGrid | None = None   # grilla de la EVA (local o recorte regional)
