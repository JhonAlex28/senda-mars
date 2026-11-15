"""Casos de uso: campo de retorno (S-1, S-7, R-3) y catálogo de escenarios."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from senda.application.planner_context import PlannerContext
from senda.domain.errors import InvalidRequest
from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.services.scenarios import SCENARIOS, Scenario


@dataclass(frozen=True)
class ReturnFieldResult:
    leg: str
    scenario: str
    values: np.ndarray          # (R, C): L de O2 (eva) o kWh (rover); inf = sin retorno
    safe_mask: np.ndarray       # bool: retorno viable con margen saliendo con tanque/batería llena
    bbox: BoundingBox
    unit: str
    max_value: float
    source_id: str


class GetReturnField:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, leg: str = "eva", scenario: str = "none",
                staging: GeoPoint | None = None) -> ReturnFieldResult:
        """EVA: campo de retorno al SEV estacionado en `staging` (por defecto, el estacionamiento
        de los objetivos del boxwork). Rover: drive-back a la base."""
        if scenario not in SCENARIOS or scenario == "blocked_path":
            raise InvalidRequest(f"Unsupported scenario for return field: '{scenario}'")
        p = self._ctx.params
        if leg == "eva":
            staging_id = "rover"
            if staging is None:
                staging, staging_id = self._ctx.default_eva_staging()
            grid = self._ctx.eva_grid([staging])
            cell = self._ctx.eva_cell(grid, staging, staging_id)
            ectx = self._ctx.eva_context(cell, scenario, grid=grid)
            values = ectx.return_o2
            mult = p.eva.suit_leak_multiplier if scenario == "suit_leak" else 1.0
            safe = values * p.eva.return_safety_factor * mult <= p.eva.o2_capacity_l
            return ReturnFieldResult(leg, scenario, values, safe, ectx.terrain.spec.bbox, "L O2",
                                     _finite_max(values), staging_id)
        if leg == "rover":
            rc = self._ctx.rover_context()
            values = rc.drive_back_kwh
            safe = values <= p.rover.battery_kwh * (1 - p.rover.battery_reserve_fraction)
            return ReturnFieldResult(leg, "none", values, safe, rc.terrain.spec.bbox, "kWh",
                                     _finite_max(values), "base")
        raise InvalidRequest("leg must be 'eva' or 'rover'")


class ListScenarios:
    def execute(self) -> list[Scenario]:
        return list(SCENARIOS.values())


def _finite_max(a: np.ndarray) -> float:
    f = a[np.isfinite(a)]
    return float(f.max()) if f.size else 0.0
