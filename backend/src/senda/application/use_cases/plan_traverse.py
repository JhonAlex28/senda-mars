"""Caso de uso: tramo en rover presurizado (R-1, R-2, R-3) en la grilla regional."""
from __future__ import annotations

from senda.application.planner_context import PlannerContext
from senda.domain.errors import NoRouteFound
from senda.domain.models.route import TraversePlan
from senda.domain.services.rover_planner import plan_traverse


class PlanTraverse:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, from_lonlat: tuple[float, float], to_lonlat: tuple[float, float],
                battery_used_before_kwh: float = 0.0) -> TraversePlan:
        rc = self._ctx.rover_context()
        grid = rc.terrain
        dil = self._ctx.params.rover.nogo_dilation_cells
        a = self._ctx.cell_for(grid, *from_lonlat, dil, "traverse origin")
        b = self._ctx.cell_for(grid, *to_lonlat, dil, "traverse destination")
        try:
            return plan_traverse(rc, a, b, battery_used_before_kwh)
        except ValueError as e:
            raise NoRouteFound(str(e)) from e
