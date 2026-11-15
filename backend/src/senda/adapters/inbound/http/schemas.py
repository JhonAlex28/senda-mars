"""DTOs HTTP (Pydantic). Separados de las entidades de dominio."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Literal

from pydantic import BaseModel, Field

from senda.application.assistant.tools import MissionContext
from senda.application.use_cases.assistant import AssistantReply
from senda.application.use_cases.plan_outing import OutingPlan
from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.models.route import (Conditions, Hazard, ParkingSpot, RoutePlan, RouteProfile,
                                       StopKind, TraversePlan, TravelMode, Waypoint)
from senda.domain.models.target import ScienceTarget
from senda.domain.services.readiness import Readiness, Verdict

# ---------- Objetivos ----------


class RubricOut(BaseModel):
    novelty: int
    habitability: int
    human_only: int
    total: int


class TaskOut(BaseModel):
    tool: str
    duration_min: float
    protocol: str


class TargetOut(BaseModel):
    id: str
    name: str
    lon: float
    lat: float
    elevation_m: float
    category: str
    description: str
    is_base: bool
    rubric: RubricOut
    task: TaskOut | None

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
            is_base=t.is_base,
            rubric=RubricOut(
                novelty=t.rubric.novelty,
                habitability=t.rubric.habitability,
                human_only=t.rubric.human_only,
                total=t.rubric.total,
            ),
            task=TaskOut(**asdict(t.task)) if t.task else None,
        )


# ---------- Ambiente ----------


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


class CheckOut(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    verdict: Verdict
    source: str


class ReadinessOut(BaseModel):
    verdict: Verdict
    sol: int
    local_solar_time: str
    checks: list[CheckOut]

    @classmethod
    def from_domain(cls, r: Readiness) -> "ReadinessOut":
        return cls(**asdict(r))


# ---------- Terreno ----------


class BBoxDto(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def to_domain(self) -> BoundingBox:
        return BoundingBox(self.min_lon, self.min_lat, self.max_lon, self.max_lat)


class TerrainOut(BaseModel):
    bbox: BBoxDto
    rows: int
    cols: int
    cell_size_m: float
    elevation_m: list[float] = Field(description="Fila a fila, de norte a sur")
    slope_deg: list[float] = Field(description="Fila a fila, de norte a sur")

    scale: str | None = Field(None, description="local | regional (motor de Mec. B)")
    kind: str | None = Field(None, description="measured | synthetic")

    @classmethod
    def from_domain(cls, g) -> "TerrainOut":   # g: application.use_cases.terrain.TerrainView
        return cls(
            bbox=BBoxDto(**asdict(g.bbox)),
            rows=g.rows,
            cols=g.cols,
            cell_size_m=round(g.cell_size_m, 3),
            elevation_m=g.elevation_m.round(1).ravel().tolist(),
            slope_deg=g.slope_deg.round(1).ravel().tolist(),
            scale=g.scale,
            kind=g.kind,
        )


# ---------- Rutas: entrada ----------


class PointIn(BaseModel):
    lon: float
    lat: float

    def to_domain(self) -> GeoPoint:
        return GeoPoint(self.lon, self.lat)


class HazardIn(PointIn):
    radius_m: float = Field(gt=0, le=500)

    def to_hazard(self) -> Hazard:
        return Hazard(self.to_domain(), self.radius_m)


class ConditionsIn(BaseModel):
    speed_factor: float = Field(1.0, gt=0.1, le=1.5, description="0.7 = tormenta de polvo")
    o2_multiplier: float = Field(1.0, ge=1.0, le=3.0, description="1.5 = fuga en el traje")

    def to_domain(self) -> Conditions:
        return Conditions(self.speed_factor, self.o2_multiplier)


class ScenarioIn(BaseModel):
    hazards: list[HazardIn] = []
    conditions: ConditionsIn = ConditionsIn()

    def domain_hazards(self) -> list[Hazard]:
        return [h.to_hazard() for h in self.hazards]


class TraverseIn(ScenarioIn):
    base: PointIn
    target_ids: list[str] = Field(min_length=1)
    vehicle_id: str | None = None
    speed_kmh: float | None = None


class EvaIn(ScenarioIn):
    rover: PointIn
    target_ids: list[str] = Field(min_length=1)


class WaypointIn(PointIn):
    kind: StopKind = StopKind.WAYPOINT
    ref_id: str = ""

    def to_waypoint(self) -> Waypoint:
        return Waypoint(self.to_domain(), self.kind, self.ref_id)


class PathIn(ScenarioIn):
    mode: TravelMode
    waypoints: list[WaypointIn] = Field(min_length=2)
    profiles: list[RouteProfile] | None = None


# ---------- Rutas: salida ----------


class RoutePointOut(BaseModel):
    lon: float
    lat: float
    elevation_m: float
    slope_deg: float
    distance_m: float
    time_min: float
    resource_used: float


class RouteStopOut(BaseModel):
    point_index: int
    kind: StopKind
    ref_id: str
    dwell_min: float
    dwell_resource: float


class ResourceOut(BaseModel):
    name: str
    unit: str
    used: float
    capacity: float
    remaining_pct: float


class RouteOut(BaseModel):
    mode: TravelMode
    profile: RouteProfile
    points: list[RoutePointOut]
    stops: list[RouteStopOut]
    distance_m: float
    duration_min: float
    max_slope_deg: float
    obstacles: int
    safety_pct: float
    resource: ResourceOut
    return_ok: bool
    # Opcionales (motor de Mec. B): el frontend actual puede ignorarlos
    pnr_index: int | None = Field(None, description="Primer punto sin retorno seguro (null = ninguno)")
    reserve_min: float | None = Field(None, description="Reserva mínima de retorno en la ruta (L o kWh)")
    infeasible_reasons: list[str] = []

    @classmethod
    def from_domain(cls, r: RoutePlan) -> "RouteOut":
        res = r.resource
        return cls(
            mode=r.mode,
            profile=r.profile,
            points=[
                RoutePointOut(
                    lon=round(p.location.lon, 7), lat=round(p.location.lat, 7),
                    elevation_m=round(p.elevation_m, 1), slope_deg=round(p.slope_deg, 1),
                    distance_m=round(p.distance_m, 1), time_min=round(p.time_min, 2),
                    resource_used=round(p.resource_used, 3),
                )
                for p in r.points
            ],
            stops=[RouteStopOut(**asdict(s)) for s in r.stops],
            distance_m=round(r.distance_m, 1),
            duration_min=round(r.duration_min, 1),
            max_slope_deg=round(r.max_slope_deg, 1),
            obstacles=r.obstacles,
            safety_pct=r.safety_pct,
            resource=ResourceOut(name=res.name, unit=res.unit, used=round(res.used, 2),
                                 capacity=res.capacity, remaining_pct=round(res.remaining_pct, 1)),
            return_ok=r.return_ok,
            pnr_index=r.pnr_index,
            reserve_min=None if r.reserve_min is None else round(r.reserve_min, 3),
            infeasible_reasons=r.infeasible_reasons,
        )


class ParkingOut(BaseModel):
    id: str
    lon: float
    lat: float
    target_ids: list[str]

    @classmethod
    def from_domain(cls, p: ParkingSpot) -> "ParkingOut":
        return cls(id=p.id, lon=p.location.lon, lat=p.location.lat, target_ids=p.target_ids)


class TraverseOut(BaseModel):
    parkings: list[ParkingOut]
    routes: list[RouteOut]

    @classmethod
    def from_domain(cls, t: TraversePlan) -> "TraverseOut":
        return cls(parkings=[ParkingOut.from_domain(p) for p in t.parkings],
                   routes=[RouteOut.from_domain(r) for r in t.routes])


# ---------- Cuántico (opcional) ----------


class QuantumOptimizeIn(BaseModel):
    """El token de IBM nunca viaja desde el navegador: se configura en el servidor."""
    base: PointIn
    selected_goal_ids: list[str] = Field(default_factory=list, max_length=20)
    speed_kmh: float = Field(8.0, gt=0, le=40)
    qpu_backend: str = Field("aer_simulator", max_length=40)
    layers: int = Field(default=2, ge=1, le=2)
    shots: int = Field(default=1024, ge=128, le=4096)
    noise_profile: Literal["ideal", "noisy-qpu", "mitigated"] = "ideal"


# ---------- Asistente ----------


class MissionIn(BaseModel):
    """Lo que el usuario tiene en pantalla: el asistente parte de ahí."""
    base: PointIn | None = None
    goals: list[str] = Field(default=[], max_length=20)
    hazards: list[HazardIn] = Field(default=[], max_length=20)
    has_plan: bool = False

    def to_context(self) -> MissionContext:
        return MissionContext(self.base.to_domain() if self.base else None, tuple(self.goals),
                              tuple(h.to_hazard() for h in self.hazards), self.has_plan)


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    """Historial completo de la conversación (el servidor no guarda estado)."""
    messages: list[ChatMessageIn] = Field(min_length=1, max_length=40)
    mission: MissionIn = MissionIn()


class HazardOut(BaseModel):
    lon: float
    lat: float
    radius_m: float


class DroppedOut(BaseModel):
    id: str
    reason: str


class OutingOut(BaseModel):
    """Plan completo que el frontend carga en pantalla sin recalcular nada."""
    planned: bool
    target_ids: list[str]
    dropped: list[DroppedOut]
    hazards: list[HazardOut]
    speed_factor: float
    o2_multiplier: float
    budget_min: float | None
    total_duration_min: float
    traverse: TraverseOut | None
    traverse_profile: RouteProfile | None
    evas: dict[str, list[RouteOut]] = Field(description="Por id de estacionamiento")
    eva_profiles: dict[str, RouteProfile]

    @classmethod
    def from_domain(cls, o: OutingPlan) -> "OutingOut":
        return cls(
            planned=o.planned,
            target_ids=o.target_ids,
            dropped=[DroppedOut(id=d.id, reason=d.reason) for d in o.dropped],
            hazards=[HazardOut(lon=h.center.lon, lat=h.center.lat, radius_m=h.radius_m)
                     for h in o.hazards],
            speed_factor=o.conditions.speed_factor,
            o2_multiplier=o.conditions.o2_multiplier,
            budget_min=o.budget_min,
            total_duration_min=o.total_min,
            traverse=TraverseOut.from_domain(o.traverse) if o.traverse else None,
            traverse_profile=o.traverse_profile,
            evas={pid: [RouteOut.from_domain(r) for r in routes] for pid, routes in o.evas.items()},
            eva_profiles=o.eva_profiles,
        )


class ViewOut(BaseModel):
    profile: RouteProfile | None
    screen: Literal["plan", "walk", "go"] | None


class ChatOut(BaseModel):
    reply: str
    refused: bool
    truncated: bool
    tools_used: list[str] = Field(description="Herramientas usadas, en orden")
    readiness: ReadinessOut | None
    outing: OutingOut | None = Field(description="Plan nuevo para cargar en pantalla")
    view: ViewOut | None = Field(description="Cambio de perfil o de pantalla")

    @classmethod
    def from_domain(cls, r: AssistantReply) -> "ChatOut":
        p = r.plans
        return cls(
            reply=r.text,
            refused=r.refused,
            truncated=r.truncated,
            tools_used=p.tools_used,
            readiness=ReadinessOut.from_domain(p.readiness) if p.readiness else None,
            outing=OutingOut.from_domain(p.outing) if p.outing else None,
            view=ViewOut(profile=p.view.profile, screen=p.view.screen) if p.view else None,
        )


class AssistantStatusOut(BaseModel):
    """enabled: activado en este servidor; reachable: el modelo responde ahora mismo."""
    enabled: bool
    reachable: bool
    model: str | None

# ===========================================================================
# Planner / Safety (Mec. B) — doc §4.4. Hacia afuera siempre [lon, lat].
# Espejo TS: frontend/src/features/route-planning/types.ts y field-simulation/types.ts
# ===========================================================================


from senda.domain.models.grid import GridSpec  # noqa: E402
from senda.domain.models.mission import MissionPlan  # noqa: E402
from senda.domain.models.route import EvaRoute, RoverRoute  # noqa: E402
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


class EvaRouteOut(BaseModel):
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
    def from_domain(cls, r: EvaRoute, spec: GridSpec) -> "EvaRouteOut":
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


class TraverseMetricsOut(BaseModel):
    dist_m: float
    ascent_m: float
    max_slope_deg: float
    energy_kWh: float
    battery_used_pct: float
    time_min: float
    feasible: bool


class RoverLegOut(BaseModel):
    path: list[LonLat]
    metrics: TraverseMetricsOut
    elevation_profile: list[ElevationPoint]
    reserve_kWh_min: float | None

    @classmethod
    def from_domain(cls, t: RoverRoute, spec: GridSpec) -> "RoverLegOut":
        m = t.metrics
        return cls(path=_lonlat(spec, t.cells),
                   metrics=TraverseMetricsOut(dist_m=round(m.dist_m, 1), ascent_m=round(m.ascent_m, 1),
                                              max_slope_deg=round(m.max_slope_deg, 2),
                                              energy_kWh=round(m.energy_kwh, 3),
                                              battery_used_pct=round(m.battery_used_pct, 2),
                                              time_min=round(m.time_min, 1), feasible=m.feasible),
                   elevation_profile=_profile_points(t.cum_dist_m, t.elevation_m),
                   reserve_kWh_min=None if t.reserve_kwh_min is None else round(t.reserve_kwh_min, 3))


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
    routes: list[EvaRouteOut]
    grid: GridInfoOut


class MissionResponse(BaseModel):
    base: PointOut
    staging: PointOut
    traverse_out: RoverLegOut
    eva: EvaBlockOut
    traverse_back: RoverLegOut
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
            traverse_out=RoverLegOut.from_domain(m.traverse_out, regional_spec),
            eva=EvaBlockOut(routes=[EvaRouteOut.from_domain(r, local_spec) for r in m.eva_routes], grid=local),
            traverse_back=RoverLegOut.from_domain(m.traverse_back, regional_spec),
            timeline_profile=m.timeline_profile,
            timeline=[TimelineItemOut(sol=a.sol, start=hours_to_ltst(a.start_h), end=hours_to_ltst(a.end_h),
                                      activity=a.activity, profile=a.profile) for a in m.timeline],
            feasible=m.feasible, warnings=[WarningOut(code=w.code, msg=w.msg) for w in m.warnings],
            regional_grid=regional, assumptions=assumptions)


class SimStopIn(BaseModel):
    target_id: str
    path_index: int


class SimRouteIn(BaseModel):
    """Basta con enviar la EvaRouteOut devuelta por /routes (se usan cells y stops)."""
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
    replanned_route: EvaRouteOut | None
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
