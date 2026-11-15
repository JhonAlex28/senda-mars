"""Caché de contextos de planificación (arrays por grilla, punto de retorno y escenario).

Los .npy se cargan una vez (TerrainProvider) y los arrays de costo / campos de retorno se
calculan una vez por (staging, condiciones, hazards) y se reutilizan entre requests.
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import replace

import numpy as np

from senda.application.ports.outbound import (MissionParamsRepository, TargetRepository,
                                              TerrainProvider)
from senda.domain.errors import InvalidRequest, OutsideSite, TargetNotFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.params import MissionParams
from senda.domain.models.route import Hazard
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import Scale, TerrainGrid
from senda.domain.services.eva_planner import EvaContext, Waypoint
from senda.domain.services.return_field import cost_to_source
from senda.domain.services.rover_planner import RoverContext
from senda.domain.services.scenarios import effect_of
from senda.domain.services.simulation import Shelter
from senda.domain.services.terrain_analysis import nogo_mask, science_raster, snap_to_passable

Cell = tuple[int, int]
MAX_CACHED = 24   # contextos por tipo (cada uno ocupa ~decenas de MB con grillas grandes)


class _LRU(OrderedDict):
    def get_or(self, key, build):
        if key in self:
            self.move_to_end(key)
            return self[key]
        value = build()
        self[key] = value
        while len(self) > MAX_CACHED:
            self.popitem(last=False)
        return value


def hazard_mask(grid: TerrainGrid, hazards: tuple[Hazard, ...], keep: list[Cell] = ()) -> np.ndarray | None:
    """Celdas dentro de algún peligro circular; `keep` (inicio/fin) nunca se bloquean."""
    if not hazards:
        return None
    rr, cc = np.ogrid[0:grid.rows, 0:grid.cols]
    mask = np.zeros(grid.spec.shape, dtype=bool)
    for h in hazards:
        r, c = grid.spec.lonlat_to_cell(h.center.lon, h.center.lat)
        rad = h.radius_m / grid.cell_size_m
        mask |= (rr - r) ** 2 + (cc - c) ** 2 <= rad ** 2
    for cell in keep:
        mask[cell] = False
    return mask


class PlannerContext:
    def __init__(self, terrain: TerrainProvider, targets: TargetRepository,
                 params: MissionParamsRepository) -> None:
        self._terrain = terrain
        self._targets = targets
        self._params = params
        self._lock = threading.RLock()
        self._eva = _LRU()
        self._rover = _LRU()
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

    def grid(self, scale: Scale) -> TerrainGrid:
        return self._terrain.get_grid(scale)

    def site_bounds(self):
        return self._terrain.site_bounds()

    def target(self, target_id: str) -> ScienceTarget:
        t = self._targets.get_by_id(target_id)
        if t is None:
            raise TargetNotFound(target_id)
        return t

    def find_target(self, target_id: str) -> ScienceTarget | None:
        return self._targets.get_by_id(target_id)

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
            raise OutsideSite(lon, lat)
        snapped = snap_to_passable(cell, nogo_mask(grid.classes, dilation))
        if snapped is None:
            raise InvalidRequest(f"{what} has no passable cell nearby")
        return snapped

    def local_cell(self, p: GeoPoint, what: str) -> Cell:
        return self.cell_for(self.local(), p.lon, p.lat, self.params.eva.nogo_dilation_cells, what)

    def regional_cell(self, p: GeoPoint, what: str) -> Cell:
        return self.cell_for(self.regional(), p.lon, p.lat, self.params.rover.nogo_dilation_cells, what)

    def waypoint(self, t: ScienceTarget) -> Waypoint:
        return Waypoint(id=t.id, cell=self.local_cell(t.location, t.id), task_min=t.task_minutes,
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

    def eva_ctx(self, staging: Cell, speed_factor: float = 1.0, risk_multiplier: float = 1.0,
                hazards: tuple[Hazard, ...] = (), keep: tuple[Cell, ...] = (),
                blocked: np.ndarray | None = None) -> EvaContext:
        """Contexto EVA con retorno al `staging` (el SEV estacionado)."""
        def build() -> EvaContext:
            terrain = self.local()
            if risk_multiplier != 1.0:
                terrain = replace(terrain, risk=np.clip(terrain.risk * risk_multiplier, 0, 1).astype(np.float32))
            mask = hazard_mask(terrain, hazards, [staging, *keep])
            if blocked is not None:
                mask = blocked if mask is None else (mask | blocked)
            return EvaContext.build(terrain, self.params.eva, self.science(), staging, speed_factor, mask)

        if blocked is not None:
            return build()
        key = (staging, round(speed_factor, 4), round(risk_multiplier, 4), hazards, keep)
        with self._lock:
            return self._eva.get_or(key, build)

    def eva_context(self, staging: Cell, scenario: str = "none",
                    blocked: np.ndarray | None = None) -> EvaContext:
        eff = effect_of(scenario, self.params.eva)
        return self.eva_ctx(staging, eff.speed_factor, eff.risk_multiplier, blocked=blocked)

    def shelters(self, scenario_ctx: EvaContext, scenario: str) -> list[Shelter]:
        key = (scenario_ctx.staging, scenario)
        if key not in self._shelters:
            out = []
            for t in self.shelter_targets():
                cell = self.waypoint(t).cell
                out.append(Shelter(id=t.id, cell=cell,
                                   return_o2=cost_to_source(scenario_ctx.energy, cell) / self.params.eva.kj_per_l_o2))
            self._shelters[key] = out
        return self._shelters[key]

    def rover_ctx(self, base: Cell, speed_factor: float = 1.0, hazards: tuple[Hazard, ...] = (),
                  keep: tuple[Cell, ...] = ()) -> RoverContext:
        """Contexto rover con drive-back hacia `base`."""
        def build() -> RoverContext:
            grid = self.regional()
            return RoverContext.build(grid, self.params.rover, base, speed_factor,
                                      hazard_mask(grid, hazards, [base, *keep]))

        key = (base, round(speed_factor, 4), hazards, keep)
        with self._lock:
            return self._rover.get_or(key, build)

    def rover_context(self) -> RoverContext:
        lon, lat = self.params.base_lonlat
        return self.rover_ctx(self.regional_cell(GeoPoint(lon, lat), "base"))
