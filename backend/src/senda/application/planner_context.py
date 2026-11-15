"""Caché de contextos de planificación (arrays por grilla y escenario).

Los .npy se cargan una vez (TerrainProvider) y los arrays de costo/campos de retorno
se calculan una vez por (staging, escenario) y se reutilizan entre requests.
"""
from __future__ import annotations

import threading
from dataclasses import replace

import numpy as np

from senda.application.ports.outbound import (MissionParamsRepository, TargetRepository,
                                              TerrainProvider)
from senda.domain.errors import InvalidRequest, TargetNotFound
from senda.domain.models.params import MissionParams
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import Scale, TerrainGrid
from senda.domain.services.eva_planner import EvaContext, Waypoint
from senda.domain.services.return_field import cost_to_source
from senda.domain.services.rover_planner import RoverContext
from senda.domain.services.scenarios import effect_of
from senda.domain.services.simulation import Shelter
from senda.domain.services.terrain_analysis import nogo_mask, science_raster, snap_to_passable

Cell = tuple[int, int]


class PlannerContext:
    def __init__(self, terrain: TerrainProvider, targets: TargetRepository,
                 params: MissionParamsRepository) -> None:
        self._terrain = terrain
        self._targets = targets
        self._params = params
        self._lock = threading.Lock()
        self._eva: dict[tuple, EvaContext] = {}
        self._rover: dict[Cell, RoverContext] = {}
        self._shelters: dict[tuple, list[Shelter]] = {}
        self._science: np.ndarray | None = None

    # ---- datos básicos -----------------------------------------------------
    @property
    def params(self) -> MissionParams:
        return self._params.get()

    def local(self) -> TerrainGrid:
        return self._terrain.get_grid(Scale.LOCAL)

    def regional(self) -> TerrainGrid:
        return self._terrain.get_grid(Scale.REGIONAL)

    def target(self, target_id: str) -> ScienceTarget:
        t = self._targets.get_by_id(target_id)
        if t is None:
            raise TargetNotFound(target_id)
        return t

    def all_targets(self) -> list[ScienceTarget]:
        return self._targets.list_all()

    def default_staging(self) -> ScienceTarget:
        for t in sorted(self.all_targets(), key=lambda t: t.id):
            if t.is_base:
                return t
        raise InvalidRequest("No staging target (is_base=true) in targets file")

    def shelter_targets(self) -> list[ScienceTarget]:
        return [t for t in self.all_targets() if t.is_shelter]

    # ---- celdas ------------------------------------------------------------
    def cell_for(self, grid: TerrainGrid, lon: float, lat: float, dilation: int, what: str) -> Cell:
        cell = grid.spec.lonlat_to_cell(lon, lat)
        if not grid.spec.contains(cell):
            raise InvalidRequest(f"{what} ({lon:.5f}, {lat:.5f}) is outside the {grid.scale.value} grid")
        snapped = snap_to_passable(cell, nogo_mask(grid.classes, dilation))
        if snapped is None:
            raise InvalidRequest(f"{what} has no passable cell nearby")
        return snapped

    def waypoint(self, t: ScienceTarget) -> Waypoint:
        grid = self.local()
        cell = self.cell_for(grid, t.location.lon, t.location.lat,
                             self.params.eva.nogo_dilation_cells, t.id)
        return Waypoint(id=t.id, cell=cell, task_min=t.eva_duration_min,
                        shielding_pct=t.shielding_pct, science_points=t.science_points)

    # ---- contextos cacheados ----------------------------------------------
    def science(self) -> np.ndarray:
        if self._science is None:
            grid = self.local()
            pts = []
            for t in self.all_targets():
                c = grid.spec.lonlat_to_cell(t.location.lon, t.location.lat)
                if grid.spec.contains(c):
                    pts.append((c, t.score_s))
            self._science = science_raster(grid.spec.shape, grid.spec.cell_size_m, pts,
                                           self.params.eva.science_radius_m)
        return self._science

    def eva_context(self, staging: Cell, scenario: str = "none",
                    blocked: np.ndarray | None = None) -> EvaContext:
        p = self.params.eva
        eff = effect_of(scenario, p)
        key = (staging, scenario) if blocked is None else None
        with self._lock:
            if key is not None and key in self._eva:
                return self._eva[key]
        terrain = self.local()
        if eff.risk_multiplier != 1.0:
            terrain = replace(terrain, risk=np.clip(terrain.risk * eff.risk_multiplier, 0, 1).astype(np.float32))
        ctx = EvaContext.build(terrain, p, self.science(), staging, eff.speed_factor, blocked)
        if key is not None:
            with self._lock:
                self._eva[key] = ctx
        return ctx

    def shelters(self, scenario_ctx: EvaContext, scenario: str) -> list[Shelter]:
        key = (scenario_ctx.staging, scenario)
        if key in self._shelters:
            return self._shelters[key]
        out = []
        for t in self.shelter_targets():
            cell = self.waypoint(t).cell
            out.append(Shelter(id=t.id, cell=cell,
                               return_o2=cost_to_source(scenario_ctx.energy, cell) / self.params.eva.kj_per_l_o2))
        self._shelters[key] = out
        return out

    def rover_context(self) -> RoverContext:
        grid = self.regional()
        lon, lat = self.params.base_lonlat
        base = self.cell_for(grid, lon, lat, self.params.rover.nogo_dilation_cells, "base")
        with self._lock:
            if base not in self._rover:
                self._rover[base] = RoverContext.build(grid, self.params.rover, base)
            return self._rover[base]
