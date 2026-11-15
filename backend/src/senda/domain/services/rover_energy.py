"""Energía eléctrica del rover presurizado (SEV) por arista.

    E = [ m·g_M·(Crr·cosθ + sinθ)·d / η ]⁺ + P_hotel·(d / v)        [J → kWh]

Sin regeneración en bajada (conservador). Doc §6.2.
"""
from __future__ import annotations

import math

import numpy as np

from senda.domain.models.params import MARS_G, RoverParams
from senda.domain.models.terrain import CLASS_CAUTION, TerrainGrid
from senda.domain.services.grid_graph import DIRS, neighbor, step_length
from senda.domain.services.terrain_analysis import nogo_mask

J_PER_KWH = 3.6e6


def min_energy_kwh_per_m(p: RoverParams) -> float:
    """Cota inferior por metro: solo la carga hotel a la velocidad nominal."""
    return p.hotel_kw * 1000.0 / (p.v_nominal_kmh / 3.6) / J_PER_KWH


def rover_step_arrays(t: TerrainGrid, p: RoverParams) -> tuple[np.ndarray, np.ndarray]:
    rows, cols = t.spec.shape
    cs = t.spec.cell_size_m
    nogo = nogo_mask(t.classes, p.nogo_dilation_cells)
    dem = t.dem.astype(np.float64)
    energy = np.empty((8, rows, cols), dtype=np.float64)
    time = np.empty((8, rows, cols), dtype=np.float64)
    max_tan = math.tan(math.radians(p.slope_nogo_deg))
    for k, (dr, dc) in enumerate(DIRS):
        d = step_length(k, cs)
        dz = neighbor(dem, dr, dc, np.nan) - dem
        nb_cls = neighbor(t.classes, dr, dc, 255)
        nb_nogo = neighbor(nogo, dr, dc, True)
        v = np.where(nb_cls == CLASS_CAUTION, p.v_caution_kmh, p.v_nominal_kmh) / 3.6
        theta = np.arctan(np.nan_to_num(dz) / d)
        traction = p.mass_kg * MARS_G * (p.crr * np.cos(theta) + np.sin(theta)) * d / p.drivetrain_eff
        e = (np.maximum(traction, 0.0) + p.hotel_kw * 1000.0 * d / v) / J_PER_KWH
        tt = d / v
        invalid = nb_nogo | ~np.isfinite(dz) | (np.abs(dz) / d > max_tan)
        e[invalid] = np.inf
        tt[invalid] = np.inf
        energy[k] = e
        time[k] = tt
    return energy, time


def rover_search_costs(energy: np.ndarray, risk: np.ndarray, w_risk: float) -> np.ndarray:
    out = np.empty_like(energy)
    for k, (dr, dc) in enumerate(DIRS):
        out[k] = energy[k] * (1.0 + w_risk * neighbor(risk.astype(np.float64), dr, dc, 1.0))
    return out
