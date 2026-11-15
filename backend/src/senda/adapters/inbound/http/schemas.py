"""DTOs HTTP (Pydantic). Separados de las entidades de dominio."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from pydantic import BaseModel

from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.target import ScienceTarget


class RubricOut(BaseModel):
    novelty: int
    habitability: int
    human_only: int
    total: int


class TargetOut(BaseModel):
    id: str
    name: str
    lon: float
    lat: float
    elevation_m: float
    category: str
    description: str
    rubric: RubricOut

    @classmethod
    def from_domain(cls, t: ScienceTarget) -> "TargetOut":
        return cls(
            id=t.id,
            name=t.name,
            lon=t.location.lon,
            lat=t.location.lat,
            elevation_m=t.elevation_m,
            category=t.category,
            description=t.description,
            rubric=RubricOut(
                novelty=t.rubric.novelty,
                habitability=t.rubric.habitability,
                human_only=t.rubric.human_only,
                total=t.rubric.total,
            ),
        )


class EnvironmentOut(BaseModel):
    sol: int
    ls_deg: float
    local_solar_time: str
    pressure_pa: float
    temp_min_c: float
    temp_max_c: float
    details: dict[str, Any]

    @classmethod
    def from_domain(cls, e: EnvironmentSnapshot) -> "EnvironmentOut":
        return cls(**asdict(e))


# ===========================================================================
# Planner / Safety (Mec. B) — doc §4.4. Hacia afuera siempre [lon, lat].
# Espejo TS: frontend/src/features/route-planning/types.ts y field-simulation/types.ts
# ===========================================================================
from typing import Literal  # noqa: E402

from pydantic import Field  # noqa: E402

from senda.domain.models.grid import GridSpec  # noqa: E402
from senda.domain.models.mission import MissionPlan  # noqa: E402
from senda.domain.models.route import RoutePlan, RouteProfile, TraversePlan  # noqa: E402
from senda.domain.services.mission_timeline import hours_to_ltst  # noqa: E402
from senda.domain.services.scenarios import Scenario  # noqa: E402
from senda.domain.services.simulation import SimRow  # noqa: E402

LonLat = tuple[float, float]
ScenarioId = Literal["none", "dust_storm", "sep_event", "suit_leak", "injury", "blocked_path"]
MAX_PROFILE_POINTS = 300


def _lonlat(spec: GridSpec, cells) -> list[LonLat]:
    return [tuple(round(v, 7) for v in spec.cell_to_lonlat(c)) for c in cells]


def _profile_points(cum_d: list[float], elev: list[float]) -> list["ElevationPoint"]:
    step = max(1, len(cum_d) // MAX_PROFILE_POINTS)
    idx = list(range(0, len(cum_d), step))
    if idx[-1] != len(cum_d) - 1:
        idx.append(len(cum_d) - 1)
    return [ElevationPoint(d_m=round(cum_d[i], 1), z_m=round(elev[i], 2)) for i in idx]


class ElevationPoint(BaseModel):
    d_m: float
    z_m: float


class RouteMetricsOut(BaseModel):
    dist_m: float
    ascent_m: float
    descent_m: float
    max_slope_deg: float
    energy_kJ: float
    o2_L: float
    time_min: float
    walk_time_min: float
    dose_mSv: float
    science_score: float
    o2_margin_at_end: float
    feasible: bool


class SegmentOut(BaseModel):
    from_: str = Field(alias="from")
    to: str
    dist_m: float
    energy_kJ: float
    time_min: float
    o2_L: float

    model_config = {"populate_by_name": True}


class StopOut(BaseModel):
    target_id: str
    path_index: int
    task_min: float
    energy_kJ: float


class RouteOut(BaseModel):
    profile: RouteProfile
    path: list[LonLat]
    cells: list[tuple[int, int]]
    metrics: RouteMetricsOut
    segments: list[SegmentOut]
    stops: list[StopOut]
    elevation_profile: list[ElevationPoint]
    pnr_index: int | None
    infeasible_reasons: list[str]

    @classmethod
    def from_domain(cls, r: RoutePlan, spec: GridSpec) -> "RouteOut":
        m = r.metrics
        return cls(
            profile=r.profile, path=_lonlat(spec, r.cells), cells=r.cells,
            metrics=RouteMetricsOut(
                dist_m=round(m.dist_m, 1), ascent_m=round(m.ascent_m, 1), descent_m=round(m.descent_m, 1),
                max_slope_deg=round(m.max_slope_deg, 2), energy_kJ=round(m.energy_kj, 1),
                o2_L=round(m.o2_l, 2), time_min=round(m.time_min, 1), walk_time_min=round(m.walk_time_min, 1),
                dose_mSv=round(m.dose_msv, 4), science_score=m.science_score,
                o2_margin_at_end=round(m.o2_margin_at_end, 4), feasible=m.feasible),
            segments=[SegmentOut(**{"from": s.from_id}, to=s.to_id, dist_m=round(s.dist_m, 1),
                                 energy_kJ=round(s.energy, 1), time_min=round(s.time_min, 1),
                                 o2_L=round(s.o2_l, 2)) for s in r.segments],
            stops=[StopOut(target_id=s.target_id, path_index=s.path_index, task_min=s.task_min,
                           energy_kJ=round(s.energy_kj, 1)) for s in r.stops],
            elevation_profile=_profile_points(r.cum_dist_m, r.elevation_m),
            pnr_index=r.pnr_index, infeasible_reasons=r.infeasible_reasons)


class AssumptionOut(BaseModel):
    value: Any
    kind: str
    source: str


class GridInfoOut(BaseModel):
    scale: str
    kind: str                 # measured | synthetic
    cell_size_m: float
    shape: tuple[int, int]
    bbox_lonlat: tuple[float, float, float, float]
    sources: list[dict[str, Any]]


class RoutesRequest(BaseModel):
    target_ids: list[str] = Field(min_length=1)
    profiles: list[RouteProfile] = Field(default_factory=lambda: list(RouteProfile))
    start_target_id: str | None = None
    end_target_id: str | None = None
    scenario: ScenarioId = "none"


class RoutesResponse(BaseModel):
    staging_id: str
    routes: list[RouteOut]
    grid: GridInfoOut
    assumptions: dict[str, AssumptionOut]


class TraverseMetricsOut(BaseModel):
    dist_m: float
    ascent_m: float
    max_slope_deg: float
    energy_kWh: float
    battery_used_pct: float
    time_min: float
    feasible: bool


class TraverseOut(BaseModel):
    path: list[LonLat]
    metrics: TraverseMetricsOut
    elevation_profile: list[ElevationPoint]
    reserve_kWh_min: float | None

    @classmethod
    def from_domain(cls, t: TraversePlan, spec: GridSpec) -> "TraverseOut":
        m = t.metrics
        return cls(path=_lonlat(spec, t.cells),
                   metrics=TraverseMetricsOut(dist_m=round(m.dist_m, 1), ascent_m=round(m.ascent_m, 1),
                                              max_slope_deg=round(m.max_slope_deg, 2),
                                              energy_kWh=round(m.energy_kwh, 3),
                                              battery_used_pct=round(m.battery_used_pct, 2),
                                              time_min=round(m.time_min, 1), feasible=m.feasible),
                   elevation_profile=_profile_points(t.cum_dist_m, t.elevation_m),
                   reserve_kWh_min=None if t.reserve_kwh_min is None else round(t.reserve_kwh_min, 3))


class TraverseRequest(BaseModel):
    from_: LonLat | None = Field(default=None, alias="from")
    to: LonLat | str | None = None   # [lon, lat] o id de objetivo (p. ej. "T01")

    model_config = {"populate_by_name": True}


class TraverseResponse(TraverseOut):
    grid: GridInfoOut
    assumptions: dict[str, AssumptionOut]


class Departure(BaseModel):
    sol: int | None = None
    ltst: str = Field(default="06:00", pattern=r"^\d{2}:\d{2}$")


class MissionRequest(BaseModel):
    base: LonLat | None = None
    staging_target_id: str | None = None
    target_ids: list[str] = Field(min_length=1)
    profiles: list[RouteProfile] = Field(default_factory=lambda: list(RouteProfile))
    timeline_profile: RouteProfile = RouteProfile.SAFE
    departure: Departure = Field(default_factory=Departure)
    scenario: ScenarioId = "none"


class PointOut(BaseModel):
    lonlat: LonLat
    target_id: str | None = None


class TimelineItemOut(BaseModel):
    sol: int
    start: str
    end: str
    activity: str
    profile: RouteProfile | None = None


class WarningOut(BaseModel):
    code: str
    msg: str


class EvaBlockOut(BaseModel):
    routes: list[RouteOut]
    grid: GridInfoOut


class MissionResponse(BaseModel):
    base: PointOut
    staging: PointOut
    traverse_out: TraverseOut
    eva: EvaBlockOut
    traverse_back: TraverseOut
    timeline_profile: RouteProfile
    timeline: list[TimelineItemOut]
    feasible: bool
    warnings: list[WarningOut]
    regional_grid: GridInfoOut
    assumptions: dict[str, AssumptionOut]

    @classmethod
    def from_domain(cls, m: MissionPlan, local: GridInfoOut, regional: GridInfoOut,
                    local_spec: GridSpec, regional_spec: GridSpec,
                    assumptions: dict[str, AssumptionOut]) -> "MissionResponse":
        return cls(
            base=PointOut(lonlat=m.base_lonlat),
            staging=PointOut(lonlat=m.staging_lonlat, target_id=m.staging_id),
            traverse_out=TraverseOut.from_domain(m.traverse_out, regional_spec),
            eva=EvaBlockOut(routes=[RouteOut.from_domain(r, local_spec) for r in m.eva_routes], grid=local),
            traverse_back=TraverseOut.from_domain(m.traverse_back, regional_spec),
            timeline_profile=m.timeline_profile,
            timeline=[TimelineItemOut(sol=a.sol, start=hours_to_ltst(a.start_h), end=hours_to_ltst(a.end_h),
                                      activity=a.activity, profile=a.profile) for a in m.timeline],
            feasible=m.feasible, warnings=[WarningOut(code=w.code, msg=w.msg) for w in m.warnings],
            regional_grid=regional, assumptions=assumptions)


class SimStopIn(BaseModel):
    target_id: str
    path_index: int


class SimRouteIn(BaseModel):
    """Basta con enviar la RouteOut devuelta por /routes (se usan cells y stops)."""
    profile: RouteProfile = RouteProfile.SAFE
    cells: list[tuple[int, int]] = Field(min_length=2)
    stops: list[SimStopIn] = Field(default_factory=list)

    model_config = {"extra": "ignore"}


class SimulateRequest(BaseModel):
    route: SimRouteIn
    scenario: ScenarioId = "none"
    scenario_at_index: int = Field(default=0, ge=0)


class AlertOut(BaseModel):
    level: Literal["info", "caution", "rtb"]
    code: str
    msg: str


class SimRowOut(BaseModel):
    t_min: float
    lonlat: LonLat
    cell: tuple[int, int]
    progress: float
    o2_left_L: float
    return_o2_L: float
    reserve_L: float
    dose_mSv: float
    next_wp: str | None
    dist_left_m: float
    alert: AlertOut | None

    @classmethod
    def from_domain(cls, r: SimRow, spec: GridSpec) -> "SimRowOut":
        def f(x: float, n: int) -> float:
            return round(x, n) if x == x and abs(x) != float("inf") else -1.0
        return cls(t_min=round(r.t_min, 2), lonlat=_lonlat(spec, [r.cell])[0], cell=r.cell,
                   progress=round(r.progress, 4), o2_left_L=f(r.o2_left_l, 2), return_o2_L=f(r.return_o2_l, 2),
                   reserve_L=f(r.reserve_l, 2), dose_mSv=round(r.dose_msv, 5), next_wp=r.next_wp,
                   dist_left_m=round(r.dist_left_m, 1),
                   alert=AlertOut(level=r.alert.level, code=r.alert.code, msg=r.alert.msg) if r.alert else None)


class DiversionOut(BaseModel):
    at_index: int
    to: str
    path: list[LonLat]


class SimulateResponse(BaseModel):
    scenario: str
    timeline: list[SimRowOut]
    replanned_route: RouteOut | None
    diversion: DiversionOut | None
    rideback: None = None          # S-8 pendiente
    assumptions: dict[str, AssumptionOut]


class ReturnFieldResponse(BaseModel):
    leg: Literal["eva", "rover"]
    scenario: str
    png_url: str
    safe_mask_png_url: str
    bbox_lonlat: tuple[float, float, float, float]
    unit: str
    max_value: float
    source_id: str


class ScenarioOut(BaseModel):
    id: str
    label: str
    effect: str
    kind: str

    @classmethod
    def from_domain(cls, s: Scenario) -> "ScenarioOut":
        return cls(id=s.id, label=s.label, effect=s.effect, kind=s.kind)
