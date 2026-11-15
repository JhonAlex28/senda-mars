"""Caso de uso: planificar una salida completa de una sola vez.

Encadena lo que el usuario hace a mano en la interfaz:
  condiciones → objetivos → travesía en rover → EVA en cada estacionamiento → perfil.

Si no se indican objetivos, se eligen por prioridad. Si hay un tiempo disponible, se
descartan los de menor prioridad hasta que la salida completa (rover + EVAs) quepa.
Si el veredicto ambiental es no_go, no se planifica nada.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from senda.application.use_cases.environment import AssessReadiness
from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse
from senda.application.use_cases.targets import ListTargets
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import (Conditions, Hazard, RoutePlan, RouteProfile,
                                       TraversePlan)
from senda.domain.models.target import ScienceTarget
from senda.domain.services.readiness import Readiness, Verdict


@dataclass(frozen=True)
class DroppedTarget:
    id: str
    reason: str   # "time" | "no_safe_return"


@dataclass(frozen=True)
class OutingPlan:
    readiness: Readiness
    target_ids: list[str] = field(default_factory=list)
    dropped: list[DroppedTarget] = field(default_factory=list)
    hazards: list[Hazard] = field(default_factory=list)
    conditions: Conditions = Conditions()
    budget_min: float | None = None
    traverse: TraversePlan | None = None
    evas: dict[str, list[RoutePlan]] = field(default_factory=dict)   # estacionamiento → rutas
    traverse_profile: RouteProfile | None = None
    eva_profiles: dict[str, RouteProfile] = field(default_factory=dict)

    @property
    def planned(self) -> bool:
        return self.traverse is not None

    def chosen_traverse(self) -> RoutePlan | None:
        return _by_profile(self.traverse.routes, self.traverse_profile) if self.traverse else None

    def chosen_eva(self, parking_id: str) -> RoutePlan | None:
        return _by_profile(self.evas.get(parking_id, []), self.eva_profiles.get(parking_id))

    @property
    def total_min(self) -> float:
        legs = [self.chosen_traverse(), *(self.chosen_eva(p) for p in self.evas)]
        return round(sum(r.duration_min for r in legs if r), 1)


class PlanOuting:
    def __init__(self, assess: AssessReadiness, targets: ListTargets,
                 traverse: PlanTraverse, eva: PlanEva) -> None:
        self._assess = assess
        self._targets = targets
        self._traverse = traverse
        self._eva = eva

    def execute(self, base: GeoPoint, target_ids: list[str] | None = None,
                budget_min: float | None = None, hazards: list[Hazard] | None = None,
                conditions: Conditions = Conditions(),
                profile: RouteProfile | None = None) -> OutingPlan:
        readiness = self._assess.execute()
        hazards = list(hazards or [])
        if readiness.verdict is Verdict.NO_GO:
            return OutingPlan(readiness, hazards=hazards, conditions=conditions,
                              budget_min=budget_min)

        candidates = list(target_ids) if target_ids else self._by_priority()
        dropped: list[DroppedTarget] = []
        best: OutingPlan | None = None
        while candidates:
            plan = self._plan(readiness, base, candidates, hazards, conditions, profile,
                              budget_min, dropped)
            blocked = _without_safe_return(plan)
            if blocked:   # una caminata o la travesía no puede volver con reserva
                candidates.remove(blocked)
                dropped.append(DroppedTarget(blocked, "no_safe_return"))
                continue
            best = plan
            if budget_min is None or plan.total_min <= budget_min or len(candidates) == 1:
                break
            dropped.append(DroppedTarget(candidates.pop(), "time"))   # el de menor prioridad
        if best is None:
            return OutingPlan(readiness, dropped=dropped, hazards=hazards,
                              conditions=conditions, budget_min=budget_min)
        return best

    def _by_priority(self) -> list[str]:
        science = [t for t in self._targets.execute() if not t.is_base]
        return [t.id for t in sorted(science, key=_priority_key)]

    def _plan(self, readiness: Readiness, base: GeoPoint, ids: list[str],
              hazards: list[Hazard], conditions: Conditions, profile: RouteProfile | None,
              budget_min: float | None, dropped: list[DroppedTarget]) -> OutingPlan:
        traverse = self._traverse.execute(base, ids, hazards, conditions)
        evas = {p.id: self._eva.execute(p.location, p.target_ids, hazards, conditions)
                for p in traverse.parkings}
        return OutingPlan(
            readiness, list(ids), list(dropped), hazards, conditions, budget_min, traverse, evas,
            _choose(traverse.routes, profile),
            {pid: c for pid, routes in evas.items() if (c := _choose(routes, profile))},
        )


def _priority_key(t: ScienceTarget) -> tuple[float, float, str]:
    """Mayor puntaje primero; a igual puntaje, la tarea más corta."""
    return (-t.rubric.total, t.task_minutes, t.id)


def _choose(routes: list[RoutePlan], wanted: RouteProfile | None) -> RouteProfile | None:
    """El perfil pedido si permite volver; si no, el más seguro de los viables."""
    viable = [r for r in routes if r.return_ok]
    if not viable:
        return None
    if wanted and any(r.profile is wanted for r in viable):
        return wanted
    return max(viable, key=lambda r: (r.safety_pct, -r.duration_min)).profile


def _by_profile(routes: list[RoutePlan], profile: RouteProfile | None) -> RoutePlan | None:
    return next((r for r in routes if r.profile is profile), None)


def _without_safe_return(plan: OutingPlan) -> str | None:
    """Objetivo a descartar si algún tramo no tiene ruta de regreso viable."""
    if plan.traverse is None:
        return None
    if plan.traverse_profile is None:
        return plan.target_ids[-1]
    for parking in plan.traverse.parkings:
        if parking.id not in plan.eva_profiles:
            # el de menor prioridad de esa caminata (el último en la lista ordenada)
            return max(parking.target_ids, key=plan.target_ids.index)
    return None
