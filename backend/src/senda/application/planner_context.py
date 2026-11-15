"""Caché de contextos de planificación (arrays por grilla, punto de retorno y escenario).

Los .npy se cargan una vez (TerrainProvider) y los arrays de costo / campos de retorno se
calculan una vez por (grilla, staging, condiciones, hazards) y se reutilizan entre requests.

Grilla de la EVA (`eva_grid`):
  * todos los puntos dentro del boxwork → grilla LOCAL (DEM de 1 m, planificada a 4 m);
  * si no → recorte de la grilla REGIONAL a su resolución nativa (10 m) alrededor del
    estacionamiento y los objetivos, reclasificado con los umbrales humanos (10/20°).
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
from senda.domain.services.parking import order_tour, propose_parkings
from senda.domain.services.terrain_analysis import (crop, for_walking, nogo_mask, science_raster,
                                                    snap_to_passable)

Cell = tuple[int, int]
MAX_CACHED = 24   # contextos por tipo (cada uno ocupa ~decenas de MB con grillas grandes)
EVA_MARGIN_M = 500.0   # margen del recorte regional alrededor de los puntos de la EVA
RETURN_FIELD_MARGIN_M = 1000.0   # el campo de retorno debe cubrir los objetivos (≤ ~550 m del SEV)
CROP_TILE_CELLS = 50   # las ventanas se alinean a teselas fijas: planificar y simular usan la misma


def grid_key(grid: TerrainGrid) -> tuple:
    s = grid.spec
    return (grid.scale.value, round(s.origin_x, 3), round(s.origin_y, 3), s.cell_size_m, s.rows, s.cols)


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
        self._shelters: _LRU = _LRU()
        self._science: _LRU = _LRU()
        self._crops: _LRU = _LRU()
        self._rover_blocked: set[Cell] | None = None
        self._eva_staging: tuple[GeoPoint, str] | None = None

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

    def base_target(self) -> ScienceTarget | None:
        return next((t for t in sorted(self.all_targets(), key=lambda t: t.id) if t.is_base), None)

    def science_targets(self) -> list[ScienceTarget]:
        return [t for t in self.all_targets() if not t.is_base]

    def rover_blocked(self, hazards: tuple[Hazard, ...] = ()) -> set[Cell]:
        """Celdas vedadas al SEV (no-go dilatado ∪ peligros); sin peligros se cachea."""
        grid = self.regional()
        if not hazards and self._rover_blocked is not None:
            return self._rover_blocked
        mask = nogo_mask(grid.classes, self.params.rover.nogo_dilation_cells)
        hz = hazard_mask(grid, hazards)
        if hz is not None:
            mask = mask | hz
        blocked = {(int(r), int(c)) for r, c in np.argwhere(mask)}
        if not hazards:
            self._rover_blocked = blocked
        return blocked

    def parkings_for(self, targets: list[ScienceTarget], base: GeoPoint | None = None,
                     hazards: tuple[Hazard, ...] = ()):
        """Estacionamientos del SEV (R-4) en orden de visita desde la base, numerados P1…Pn
        igual que /routes/traverse. La base (is_base) no es un objetivo."""
        if base is None:
            base = GeoPoint(*self.params.base_lonlat)
        science = [t for t in targets if not t.is_base]
        if not science:
            raise InvalidRequest("No science targets selected")
        return order_tour(base, propose_parkings(self.regional(), science, self.rover_blocked(hazards)))

    def default_eva_staging(self) -> tuple[GeoPoint, str]:
        """Staging EVA por defecto: el estacionamiento de los objetivos del boxwork (o del primero)."""
        if self._eva_staging is None:
            local = self.local()
            science = self.science_targets()
            if not science:
                raise InvalidRequest("No science targets in targets file")
            boxwork = [t for t in science if local.contains(t.location)] or science[:1]
            pk = next(p for p in self.parkings_for(science) if set(p.target_ids) & {t.id for t in boxwork})
            self._eva_staging = (pk.location, pk.id)
        return self._eva_staging

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
        return self.eva_cell(self.local(), p, what)

    def eva_cell(self, grid: TerrainGrid, p: GeoPoint, what: str) -> Cell:
        return self.cell_for(grid, p.lon, p.lat, self.params.eva.nogo_dilation_cells, what)

    def regional_cell(self, p: GeoPoint, what: str) -> Cell:
        return self.cell_for(self.regional(), p.lon, p.lat, self.params.rover.nogo_dilation_cells, what)

    def waypoint(self, t: ScienceTarget, grid: TerrainGrid | None = None) -> Waypoint:
        grid = grid or self.local()
        return Waypoint(id=t.id, cell=self.eva_cell(grid, t.location, t.id), task_min=t.task_minutes,
                        shielding_pct=t.shielding_pct, science_points=t.science_points)

    # ---- grilla de la EVA --------------------------------------------------
    def eva_grid(self, points: list[GeoPoint], margin_m: float = EVA_MARGIN_M) -> TerrainGrid:
        """Local (1 m) si todos los puntos están en el boxwork; si no, recorte regional (10 m)
        con `margin_m` alrededor de los puntos, alineado a teselas de CROP_TILE_CELLS."""
        local = self.local()
        if all(local.contains(p) for p in points):
            return local
        native = self._terrain.native_grid(Scale.REGIONAL)
        for p in points:
            if not native.contains(p):
                raise OutsideSite(p.lon, p.lat)
        cells = [native.spec.lonlat_to_cell(p.lon, p.lat) for p in points]
        m, t = int(np.ceil(margin_m / native.spec.cell_size_m)), CROP_TILE_CELLS
        r0 = max(0, (min(c[0] for c in cells) - m) // t * t)
        c0 = max(0, (min(c[1] for c in cells) - m) // t * t)
        r1 = min(native.spec.rows, -(-(max(c[0] for c in cells) + m + 1) // t) * t)
        c1 = min(native.spec.cols, -(-(max(c[1] for c in cells) + m + 1) // t) * t)
        e = self.params.eva

        def build() -> TerrainGrid:
            return for_walking(crop(native, r0, r1, c0, c1), e.slope_caution_deg, e.slope_nogo_deg)

        with self._lock:
            return self._crops.get_or((r0, r1, c0, c1), build)

    # ---- contextos cacheados ----------------------------------------------
    def science(self, grid: TerrainGrid | None = None) -> np.ndarray:
        grid = grid or self.local()
        def build() -> np.ndarray:
            pts = []
            for t in self.all_targets():
                c = grid.spec.lonlat_to_cell(t.location.lon, t.location.lat)
                if grid.spec.contains(c):
                    pts.append((c, t.score_s))
            return science_raster(grid.spec.shape, grid.spec.cell_size_m, pts,
                                  self.params.eva.science_radius_m)

        with self._lock:
            return self._science.get_or(grid_key(grid), build)

    def eva_ctx(self, staging: Cell, speed_factor: float = 1.0, risk_multiplier: float = 1.0,
                hazards: tuple[Hazard, ...] = (), keep: tuple[Cell, ...] = (),
                blocked: np.ndarray | None = None, grid: TerrainGrid | None = None) -> EvaContext:
        """Contexto EVA con retorno al `staging` (el SEV estacionado) en `grid` (local por defecto)."""
        grid = grid or self.local()

        def build() -> EvaContext:
            terrain = grid
            if risk_multiplier != 1.0:
                terrain = replace(terrain, risk=np.clip(terrain.risk * risk_multiplier, 0, 1).astype(np.float32))
            mask = hazard_mask(terrain, hazards, [staging, *keep])
            if blocked is not None:
                mask = blocked if mask is None else (mask | blocked)
            return EvaContext.build(terrain, self.params.eva, self.science(grid), staging, speed_factor, mask)

        if blocked is not None:
            return build()
        # `keep` solo importa si hay peligros (celdas que nunca se bloquean)
        key = (grid_key(grid), staging, round(speed_factor, 4), round(risk_multiplier, 4), hazards,
               keep if hazards else ())
        with self._lock:
            return self._eva.get_or(key, build)

    def eva_context(self, staging: Cell, scenario: str = "none",
                    blocked: np.ndarray | None = None, grid: TerrainGrid | None = None) -> EvaContext:
        eff = effect_of(scenario, self.params.eva)
        return self.eva_ctx(staging, eff.speed_factor, eff.risk_multiplier, blocked=blocked, grid=grid)

    def shelters(self, scenario_ctx: EvaContext, scenario: str) -> list[Shelter]:
        """Refugios alternativos (is_shelter) dentro de la grilla de esa EVA."""
        grid = scenario_ctx.terrain
        def build() -> list[Shelter]:
            out = []
            for t in self.shelter_targets():
                if not grid.contains(t.location):
                    continue
                cell = self.waypoint(t, grid).cell
                out.append(Shelter(id=t.id, cell=cell,
                                   return_o2=cost_to_source(scenario_ctx.energy, cell) / self.params.eva.kj_per_l_o2))
            return out

        with self._lock:
            return self._shelters.get_or((grid_key(grid), scenario_ctx.staging, scenario), build)

    def rover_ctx(self, base: Cell, speed_factor: float = 1.0, hazards: tuple[Hazard, ...] = (),
                  keep: tuple[Cell, ...] = ()) -> RoverContext:
        """Contexto rover con drive-back hacia `base`."""
        def build() -> RoverContext:
            grid = self.regional()
            return RoverContext.build(grid, self.params.rover, base, speed_factor,
                                      hazard_mask(grid, hazards, [base, *keep]))

        key = (base, round(speed_factor, 4), hazards, keep if hazards else ())
        with self._lock:
            return self._rover.get_or(key, build)

    def rover_context(self) -> RoverContext:
        lon, lat = self.params.base_lonlat
        return self.rover_ctx(self.regional_cell(GeoPoint(lon, lat), "base"))
