import pytest

from senda.domain.errors import NoRouteFound
from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.models.route import Conditions, Hazard, RouteProfile, StopKind, Waypoint
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.mobility import EvaModel, RoverModel
from senda.domain.services.route_planner import plan_route

BOX = BoundingBox(0.0, 0.0, 0.01, 0.01)   # ~590 m de lado
N = 30


def _grid(slope_fn) -> TerrainGrid:
    slope = [[slope_fn(r, c) for c in range(N)] for r in range(N)]
    return TerrainGrid(BOX, N, N, [[0.0] * N for _ in range(N)], slope)


def _flat() -> TerrainGrid:
    return _grid(lambda r, c: 0.0)


def _wall_with_gap(gap_slope: float) -> TerrainGrid:
    """Muro infranqueable en la columna 15, con un paso en la fila 2."""
    return _grid(lambda r, c: (gap_slope if r == 2 else 40.0) if c == 15 else 0.0)


def _ends(grid: TerrainGrid):
    a = Waypoint(grid.point_of((15, 2)), StopKind.BASE, "base")
    b = Waypoint(grid.point_of((15, 27)), StopKind.PARKING, "P1", dwell_min=10)
    return [a, b]


def test_route_avoids_impassable_slope():
    grid = _wall_with_gap(gap_slope=0.0)
    plan = plan_route(grid, _ends(grid), RoverModel(), RouteProfile.FAST, [], Conditions())
    crossing = [p for p in plan.points if grid.cell_of(p.location)[1] == 15]
    assert crossing and all(grid.cell_of(p.location)[0] == 2 for p in crossing)


def test_route_avoids_hazard():
    grid = _flat()
    hazard = Hazard(grid.point_of((15, 15)), radius_m=60)
    plan = plan_route(grid, _ends(grid), RoverModel(), RouteProfile.FAST, [hazard], Conditions())
    assert all(p.location.distance_to(hazard.center) > hazard.radius_m - grid.cell_size_m
               for p in plan.points)


def test_no_route_raises():
    grid = _grid(lambda r, c: 40.0 if c == 15 else 0.0)
    with pytest.raises(NoRouteFound):
        plan_route(grid, _ends(grid), RoverModel(), RouteProfile.SAFE, [], Conditions())


def test_safe_profile_avoids_caution_slope_that_fast_accepts():
    # Paso corto por pendiente de precaución (15°) frente a rodeo largo por terreno llano
    grid = _grid(lambda r, c: 15.0 if c == 15 and r > 5 else 0.0)
    fast = plan_route(grid, _ends(grid), RoverModel(), RouteProfile.FAST, [], Conditions())
    safe = plan_route(grid, _ends(grid), RoverModel(), RouteProfile.SAFE, [], Conditions())
    assert fast.obstacles >= 1 and safe.obstacles == 0
    assert safe.distance_m > fast.distance_m
    assert safe.safety_pct > fast.safety_pct


def test_dwell_and_resources_are_accumulated():
    grid = _flat()
    plan = plan_route(grid, _ends(grid), EvaModel(), RouteProfile.FAST, [], Conditions())
    assert plan.duration_min == pytest.approx(plan.points[-1].time_min + 10)
    assert plan.resource.used > plan.points[-1].resource_used > 0
    assert plan.stops[-1].ref_id == "P1"


def test_dust_storm_slows_and_leak_costs_oxygen():
    grid = _flat()
    nominal = plan_route(grid, _ends(grid), EvaModel(), RouteProfile.FAST, [], Conditions())
    storm = plan_route(grid, _ends(grid), EvaModel(), RouteProfile.FAST, [], Conditions(speed_factor=0.7))
    leak = plan_route(grid, _ends(grid), EvaModel(), RouteProfile.FAST, [], Conditions(o2_multiplier=1.5))
    assert storm.duration_min > nominal.duration_min
    assert leak.resource.used == pytest.approx(nominal.resource.used * 1.5)


def test_waypoints_in_the_same_cell_each_get_a_stop():
    grid = _flat()
    here = grid.point_of((10, 10))
    near = GeoPoint(here.lon + 1e-6, here.lat)          # misma celda
    far = grid.point_of((10, 20))
    waypoints = [Waypoint(here, StopKind.WAYPOINT), Waypoint(near, StopKind.TARGET, "T1", 5),
                 Waypoint(far, StopKind.ROVER, "rover")]
    plan = plan_route(grid, waypoints, EvaModel(), RouteProfile.FAST, [], Conditions())
    assert [s.ref_id for s in plan.stops] == ["T1", "rover"]
    assert plan.stops[0].point_index == 0


def test_exact_waypoint_coordinates_are_kept():
    grid = _flat()
    start = GeoPoint(0.00123, 0.00456)
    ends = [Waypoint(start, StopKind.ROVER), _ends(grid)[1]]
    plan = plan_route(grid, ends, EvaModel(), RouteProfile.SAFE, [], Conditions())
    assert plan.points[0].location == start
