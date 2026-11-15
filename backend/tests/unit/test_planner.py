"""Tests mínimos del planificador (doc §8) sobre la grilla sintética."""
import math

import numpy as np
import pytest

from senda.domain.models.params import EvaParams, MissionWindow, ProfileWeights, RoverParams
from senda.domain.models.route import RouteProfile
from senda.domain.models.terrain import CLASS_NOGO, Scale
from senda.domain.services.eva_planner import EvaContext, Waypoint, plan_eva
from senda.domain.services.grid_graph import DIR_INDEX
from senda.domain.services.metabolic import eva_step_arrays
from senda.domain.services.mission_timeline import build_timeline
from senda.domain.services.pathfinding import grid_astar
from senda.domain.services.rover_energy import rover_step_arrays
from senda.domain.services.safety_rules import pnr_index
from senda.domain.services.terrain_analysis import nogo_mask, science_raster
from tests.fixtures.synthetic import TARGET_CELLS, synthetic_grid

P = EvaParams()
SAFE = ProfileWeights(3.5, 0.1)
FAST = ProfileWeights(0.0, 0.0)


@pytest.fixture(scope="module")
def ctx():
    g = synthetic_grid()
    sci = science_raster(g.spec.shape, g.spec.cell_size_m, [(TARGET_CELLS["TA"], 0.9)], 15.0)
    return EvaContext.build(g, P, sci, TARGET_CELLS["BASE"])


def _wps():
    b, a, t = TARGET_CELLS["BASE"], TARGET_CELLS["TA"], TARGET_CELLS["TB"]
    return [Waypoint("BASE", b), Waypoint("TA", a, 20, 0, 10), Waypoint("TB", t, 25, 20, 12), Waypoint("BASE", b)]


def test_astar_equals_dijkstra_with_pandolf(ctx):
    costs = ctx.search(SAFE)
    _, c_astar = grid_astar(costs, TARGET_CELLS["BASE"], TARGET_CELLS["TB"], ctx.h_per_cell(SAFE))
    _, c_dijk = grid_astar(costs, TARGET_CELLS["BASE"], TARGET_CELLS["TB"], 0.0)
    assert math.isclose(c_astar, c_dijk, rel_tol=1e-9)


def test_route_avoids_nogo(ctx):
    route = plan_eva(ctx, RouteProfile.SAFE, SAFE, _wps(), 360)
    mask = nogo_mask(ctx.terrain.classes, P.nogo_dilation_cells)
    assert not any(mask[c] for c in route.cells[1:-1])


def test_uphill_costs_more_eva_and_rover():
    g = synthetic_grid(wall=False)
    e, _ = eva_step_arrays(g, P)
    i = (g.spec.rows // 2 + 6, g.spec.cols // 2)   # ladera sur de la colina
    j = (i[0] - 1, i[1])                          # paso hacia la cima (sube)
    assert g.dem[j] > g.dem[i]
    up = e[DIR_INDEX[(-1, 0)], i[0], i[1]]
    down = e[DIR_INDEX[(1, 0)], j[0], j[1]]
    assert up > down
    rg = synthetic_grid(Scale.REGIONAL, 15, 25, wall=False)
    re, _ = rover_step_arrays(rg, RoverParams())
    assert re[DIR_INDEX[(-1, 0)], i[0], i[1]] > re[DIR_INDEX[(1, 0)], j[0], j[1]]


def test_return_field_zero_at_source_and_finite(ctx):
    assert ctx.return_o2[TARGET_CELLS["BASE"]] == 0.0
    assert np.isfinite(ctx.return_o2[TARGET_CELLS["TB"]])
    assert ctx.return_o2[TARGET_CELLS["TB"]] > ctx.return_o2[TARGET_CELLS["BASE"]]


def test_pnr_detected_with_small_tank():
    g = synthetic_grid()
    small = EvaParams(o2_capacity_l=6.0)
    c = EvaContext.build(g, small, np.zeros(g.spec.shape, np.float32), TARGET_CELLS["BASE"])
    route = plan_eva(c, RouteProfile.FAST, FAST, _wps(), 360)
    assert route.pnr_index is not None and route.pnr_index < len(route.cells) - 1
    assert not route.metrics.feasible and "PNR_ON_ROUTE" in route.infeasible_reasons
    assert pnr_index([3.0, 1.0, -0.5, 2.0]) == 2


def test_profiles_differ(ctx):
    safe = plan_eva(ctx, RouteProfile.SAFE, SAFE, _wps(), 360)
    fast = plan_eva(ctx, RouteProfile.FAST, FAST, _wps(), 360)
    assert safe.cells != fast.cells
    assert fast.metrics.energy_kj <= safe.metrics.energy_kj + 1e-6


def test_metrics_and_stops(ctx):
    r = plan_eva(ctx, RouteProfile.SAFE, SAFE, _wps(), 360)
    assert [s.target_id for s in r.stops] == ["TA", "TB"]
    assert r.metrics.science_score == 22
    assert math.isclose(r.metrics.time_min, r.metrics.walk_time_min + 45, rel_tol=1e-9)
    assert math.isclose(r.metrics.o2_l, r.metrics.energy_kj / P.kj_per_l_o2)
    assert r.metrics.feasible


def test_rover_crosses_slope_human_cannot():
    g = synthetic_grid(wall=False)
    ramp = np.tan(np.radians(18.0)) * g.spec.cell_size_m * np.arange(g.spec.cols, dtype=np.float32)
    dem = (np.zeros(g.spec.shape, np.float32) + ramp[None, :]).astype(np.float32)
    from senda.domain.models.terrain import TerrainGrid
    from senda.domain.services.terrain_analysis import classify_slope
    human = TerrainGrid(Scale.LOCAL, g.spec, dem, classify_slope(dem, 4.0, 10, 20), g.risk, g.confidence)
    rover = TerrainGrid(Scale.REGIONAL, g.spec, dem, classify_slope(dem, 4.0, 15, 25), g.risk, g.confidence)
    eh, _ = eva_step_arrays(human, EvaParams(slope_nogo_deg=20))
    er, _ = rover_step_arrays(rover, RoverParams())
    k = DIR_INDEX[(0, 1)]
    r, c = g.spec.rows // 2, g.spec.cols // 2
    assert np.isfinite(er[k, r, c])          # rover: 18° < 25° → transitable
    # humano: 18° está bajo el no-go (20°) pero es "precaución" → más lento y caro
    assert human.classes[r, c] == 1
    steep = (dem * 1.25).astype(np.float32)  # ~22° → no-go a pie, ok rover
    human2 = TerrainGrid(Scale.LOCAL, g.spec, steep, classify_slope(steep, 4.0, 10, 20), g.risk, g.confidence)
    rover2 = TerrainGrid(Scale.REGIONAL, g.spec, steep, classify_slope(steep, 4.0, 15, 25), g.risk, g.confidence)
    assert not np.isfinite(eva_step_arrays(human2, EvaParams())[0][k, r, c])
    assert np.isfinite(rover_step_arrays(rover2, RoverParams())[0][k, r, c])
    assert human2.classes[r, c] == CLASS_NOGO


def test_timeline_respects_eva_window():
    w = MissionWindow()
    rover = RoverParams()
    tl, _ = build_timeline(w, rover, 5074, 6.0, 4 * 3699.0, 330, 4 * 3699.0, RouteProfile.SAFE)
    for a in tl:
        if a.activity == "eva":
            assert a.start_h >= w.eva_start_h - 1e-9 and a.end_h <= w.eva_end_h + 1e-9
        if a.activity.startswith("drive"):
            assert a.start_h >= w.sunrise_h - 1e-9 and a.end_h <= w.sunset_h + 1e-9
    # 4 h de ida no dejan EVA de 5.5 h el mismo sol → pernocte y EVA el sol siguiente
    eva = next(a for a in tl if a.activity == "eva")
    assert eva.sol == 5075
