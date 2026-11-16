"""Ajuste al tiempo disponible: mismos objetivos que quitando de uno en uno, con muchos menos planes.

Con el catálogo grande (15 objetivos en ~13 km), quitar de uno en uno replanificaba la travesía
completa hasta 15 veces (~50 s en la laptop, minutos en Render gratis)."""
from types import SimpleNamespace

from senda.application.use_cases.plan_outing import PlanOuting
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import ParkingSpot, RouteProfile, TraversePlan
from senda.domain.services.readiness import Readiness, Verdict

IDS = [f"S{i:02d}" for i in range(1, 16)]   # ya en orden de prioridad


def _route(minutes: float, ok: bool = True):
    return SimpleNamespace(profile=RouteProfile.SAFE, duration_min=minutes, return_ok=ok, safety_pct=90.0)


class _Assess:
    def execute(self):
        return Readiness(Verdict.GO, 1, "12:00", [])


class _Targets:
    def execute(self):
        return []


class _Traverse:
    """Cada objetivo suma 30 min de rover; una sola parada con todos."""

    def __init__(self, no_return: set[str] = frozenset()):
        self.calls, self.no_return = 0, no_return

    def execute(self, base, ids, hazards, conditions):
        self.calls += 1
        return TraversePlan([ParkingSpot("P1", GeoPoint(0, 0), list(ids))], [_route(30.0 * len(ids))])


class _Eva:
    def __init__(self, no_return: set[str] = frozenset()):
        self.no_return = no_return

    def execute(self, location, ids, hazards, conditions):
        return [_route(10.0 * len(ids), ok=not (set(ids) & self.no_return))]


def _outing(no_return: set[str] = frozenset()):
    traverse = _Traverse()
    return PlanOuting(_Assess(), _Targets(), traverse, _Eva(no_return)), traverse


def test_keeps_the_highest_priority_targets_that_fit_with_few_plans():
    outing, traverse = _outing()
    plan = outing.execute(GeoPoint(0, 0), target_ids=list(IDS), budget_min=200)   # 40 min por objetivo
    assert plan.target_ids == IDS[:5] and plan.total_min <= 200
    assert [d.id for d in plan.dropped] == list(reversed(IDS[5:]))   # del último hacia atrás
    assert all(d.reason == "time" for d in plan.dropped)
    assert traverse.calls <= 6   # antes: 11 (uno por cada objetivo descartado)


def test_everything_fits_in_one_plan():
    outing, traverse = _outing()
    plan = outing.execute(GeoPoint(0, 0), target_ids=list(IDS), budget_min=10_000)
    assert plan.target_ids == IDS and not plan.dropped and traverse.calls == 1


def test_not_even_the_first_fits_keeps_only_the_first():
    outing, _ = _outing()
    plan = outing.execute(GeoPoint(0, 0), target_ids=list(IDS), budget_min=20)
    assert plan.target_ids == IDS[:1] and len(plan.dropped) == 14


def test_targets_without_a_safe_return_are_dropped_before_fitting_the_time():
    outing, _ = _outing(no_return={"S02"})
    plan = outing.execute(GeoPoint(0, 0), target_ids=list(IDS), budget_min=200)
    # Sin regreso en la caminata se descarta el de menor prioridad de esa parada (aquí todos
    # comparten una), hasta que la caminata vuelve: el culpable S02 sale, y nada sale "por tiempo"
    assert plan.target_ids == ["S01"] and plan.total_min <= 200
    assert {d.id for d in plan.dropped} == set(IDS[1:])
    assert all(d.reason == "no_safe_return" for d in plan.dropped)
