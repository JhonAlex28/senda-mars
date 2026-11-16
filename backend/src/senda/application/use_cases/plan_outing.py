"""Caso de uso: planificar una salida completa de una sola vez.

Encadena lo que el usuario hace a mano en la interfaz:
  condiciones → objetivos → travesía en rover → EVA en cada estacionamiento → perfil.

Si no se indican objetivos, se eligen por prioridad. Si hay un tiempo disponible, se
descartan los de menor prioridad hasta que la salida completa (rover + EVAs) quepa.
Si el veredicto ambiental es no_go, no se planifica nada.
"""
from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field, replace

from senda.application.use_cases.environment import AssessReadiness
from senda.application.use_cases.plan_routes import PlanEva, PlanTraverse
from senda.application.use_cases.targets import ListTargets
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import (Conditions, Hazard, RoutePlan, RouteProfile,
                                       TraversePlan)
from senda.domain.models.target import ScienceTarget
from senda.domain.services.parking import tour_order
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

        dropped: list[DroppedTarget] = []   # sin regreso seguro (los de tiempo se añaden al final)
        if target_ids:
            candidates = list(target_ids)   # los nombra el usuario: se respetan
        else:
            # Sin objetivos: los de mayor prioridad entre los que caben en el tiempo (por
            # defecto, una salida normal). Los que ni solos caben se descartan antes de planificar
            budget_min = budget_min or DEFAULT_BUDGET_MIN
            candidates, far = self._reachable(base, budget_min)
            dropped.extend(DroppedTarget(i, "time") for i in far)

        def plan_first(k: int) -> OutingPlan | None:
            """Plan con los k primeros objetivos (los de mayor prioridad). Los que no tienen
            regreso seguro se descartan del todo y se vuelve a intentar."""
            while candidates:
                k = min(k, len(candidates))
                plan = self._plan(readiness, base, candidates[:k], hazards, conditions,
                                  profile, budget_min, dropped)
                blocked = _without_safe_return(plan)
                if not blocked:
                    return plan
                candidates.remove(blocked)   # una caminata o la travesía no puede volver
                dropped.append(DroppedTarget(blocked, "no_safe_return"))
            return None

        best = plan_first(len(candidates))
        if best is not None and budget_min is not None and best.total_min > budget_min:
            best = self._fit_budget(plan_first, len(candidates), budget_min)
        if best is None:
            return OutingPlan(readiness, dropped=dropped, hazards=hazards,
                              conditions=conditions, budget_min=budget_min)
        # Por tiempo quedan fuera los de menor prioridad, del último hacia atrás
        kept = len(best.target_ids)
        time_dropped = [DroppedTarget(i, "time") for i in reversed(candidates[kept:])]
        return replace(best, dropped=[*dropped, *time_dropped])

    @staticmethod
    def _fit_budget(plan_first: Callable[[int], OutingPlan | None], total: int,
                    budget_min: float) -> OutingPlan | None:
        """Cuántos objetivos de la lista caben en el tiempo, por búsqueda binaria: con 15
        objetivos son ~4 planes en vez de uno por cada objetivo descartado. Más objetivos
        nunca acortan la salida, así que basta con encontrar el mayor k que cabe."""
        fits = plan_first(1)
        if fits is None or fits.total_min > budget_min:
            return fits   # ni el más importante cabe: se planifica solo ese, como antes
        lo, hi = 1, total   # con lo objetivos cabe; con hi no
        while hi - lo > 1:   # cada vuelta sube lo o baja hi: siempre termina
            mid = (lo + hi) // 2
            plan = plan_first(mid)
            if plan is None:
                break
            got = len(plan.target_ids)   # < mid si se descartaron objetivos sin regreso
            if plan.total_min <= budget_min:
                fits = plan
                if got < mid:
                    break   # ya no quedan más objetivos que probar
                lo = mid
            else:
                hi = min(mid, got)
        return fits

    def _reachable(self, base: GeoPoint, budget_min: float) -> tuple[list[str], list[str]]:
        """Elige por prioridad sin planificar: cada objetivo entra si la salida estimada con él
        sigue cabiendo en el tiempo; si no, se salta y se prueba el siguiente (uno lejano no
        impide llevar otros cercanos). Si ninguno cabe, se queda el más cercano.
        Devuelve (elegidos por prioridad, descartados)."""
        science = sorted((t for t in self._targets.execute() if not t.is_base), key=_priority_key)
        chosen: list[ScienceTarget] = []
        for t in science:
            if estimate_minutes(base, [*chosen, t]) <= budget_min * ESTIMATE_MARGIN:
                chosen.append(t)
        if not chosen and science:
            chosen = [min(science, key=lambda t: estimate_minutes(base, [t]))]
        ids = [t.id for t in chosen]
        return ids, [t.id for t in science if t.id not in ids]

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


DEFAULT_BUDGET_MIN = 240.0   # sin objetivos ni tiempo: una salida de 4 horas
# Minutos por km de recorrido en línea recta (rover a 5 km/h más los rodeos del terreno).
# Calibrado contra el planificador con targets_v1 (ir a un objetivo y volver = 2 x distancia):
# error de pocos minutos en los 15 objetivos
MINUTES_PER_KM = 13.0
ESTIMATE_MARGIN = 0.95       # la estimación apunta un poco por debajo del tiempo disponible


def estimate_minutes(base: GeoPoint, targets: Sequence[ScienceTarget]) -> float:
    """Duración aproximada de una salida a esos objetivos, sin planificar: el recorrido en
    línea recta base → objetivos → base (en el orden que optimizaría el planificador) más
    las tareas científicas."""
    points = [t.location for t in targets]
    path = [base, *(points[i] for i in tour_order(base, points)), base]
    km = sum(a.distance_to(b) for a, b in zip(path, path[1:])) / 1000
    return MINUTES_PER_KM * km + sum(t.task_minutes for t in targets)


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
