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
from senda.domain.models.terrain import TerrainGrid
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

    @classmethod
    def from_domain(cls, g: TerrainGrid) -> "TerrainOut":
        return cls(
            bbox=BBoxDto(**asdict(g.bbox)),
            rows=g.rows,
            cols=g.cols,
            cell_size_m=round(g.cell_size_m, 3),
            elevation_m=[round(v, 1) for row in g.elevation_m for v in row],
            slope_deg=[round(v, 1) for row in g.slope_deg for v in row],
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
    enabled: bool
    model: str | None
