"""Costo metabólico de la EVA (Pandolf, Givoni & Goldman 1977) a gravedad marciana.

    M = suit · [ 1.5·W + g_ratio·( 2.0·(W+L)·(L/W)² + η·(W+L)·(1.5·V² + 0.35·V·G⁺) ) ]   [W]

El metabolismo basal (1.5·W) NO se escala por la gravedad (doc §6.1). G⁺ = max(G, 0) en %:
en bajada se usa el costo plano (conservador). Funciona con escalares o arrays numpy.
"""
from __future__ import annotations

import math

import numpy as np

from senda.domain.models.params import EvaParams
from senda.domain.models.terrain import CLASS_CAUTION, TerrainGrid
from senda.domain.services.grid_graph import DIRS, neighbor, step_length
from senda.domain.services.terrain_analysis import nogo_mask


def pandolf_watts(body_kg, load_kg, speed_m_s, grade_pct, terrain_factor=1.2,
                  g_ratio=0.3794, suit_multiplier=1.25):
    w, l, v = body_kg, load_kg, speed_m_s
    g_pos = np.maximum(grade_pct, 0.0)
    moving = 2.0 * (w + l) * (l / w) ** 2 + terrain_factor * (w + l) * (1.5 * v ** 2 + 0.35 * v * g_pos)
    return suit_multiplier * (1.5 * w + g_ratio * moving)


def o2_liters(energy_kj: float, kj_per_l: float = 20.1) -> float:
    return energy_kj / kj_per_l


def watts_at(p: EvaParams, speed_m_s, grade_pct):
    return pandolf_watts(p.body_kg, p.load_kg, speed_m_s, grade_pct,
                         p.terrain_factor_eta, p.g_ratio, p.suit_multiplier)


def min_energy_kj_per_m(p: EvaParams, speed_factor: float = 1.0) -> float:
    """Cota inferior de energía por metro (en plano, a la velocidad más favorable).
    Se usa en la heurística admisible de A*."""
    speeds = [p.v_nominal_m_s * speed_factor, p.v_nominal_m_s * p.caution_speed_factor * speed_factor]
    return min(float(watts_at(p, v, 0.0)) / v for v in speeds) / 1000.0


def eva_step_arrays(t: TerrainGrid, p: EvaParams, speed_factor: float = 1.0,
                    blocked: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Energía real (kJ) y tiempo (s) de cada arista, shape (8, rows, cols). inf = inválida."""
    rows, cols = t.spec.shape
    cs = t.spec.cell_size_m
    nogo = nogo_mask(t.classes, p.nogo_dilation_cells)
    if blocked is not None:
        nogo = nogo | blocked
    dem = t.dem.astype(np.float64)
    energy = np.empty((8, rows, cols), dtype=np.float64)
    time = np.empty((8, rows, cols), dtype=np.float64)
    max_tan = math.tan(math.radians(p.slope_nogo_deg))
    for k, (dr, dc) in enumerate(DIRS):
        d = step_length(k, cs)
        dz = neighbor(dem, dr, dc, np.nan) - dem
        nb_cls = neighbor(t.classes, dr, dc, 255)
        nb_nogo = neighbor(nogo, dr, dc, True)
        v = np.where(nb_cls == CLASS_CAUTION, p.caution_speed_factor, 1.0) * p.v_nominal_m_s * speed_factor
        grade = 100.0 * dz / d
        m = watts_at(p, v, np.nan_to_num(grade))
        e = m * (d / v) / 1000.0
        tt = d / v
        invalid = nb_nogo | ~np.isfinite(dz) | (np.abs(dz) / d > max_tan)
        e[invalid] = np.inf
        tt[invalid] = np.inf
        energy[k] = e
        time[k] = tt
    return energy, time


def search_costs(energy: np.ndarray, risk: np.ndarray, science: np.ndarray | None,
                 w_risk: float, w_science: float) -> np.ndarray:
    """c = E·(1 + w_r·risk[j])·(1 − w_s·science[j]),  con w_s ≤ 0.5 para que c > 0."""
    if w_science > 0.5:
        raise ValueError("w_science must be <= 0.5 so that edge costs stay positive")
    out = np.empty_like(energy)
    for k, (dr, dc) in enumerate(DIRS):
        factor = 1.0 + w_risk * neighbor(risk.astype(np.float64), dr, dc, 1.0)
        if science is not None and w_science > 0:
            factor = factor * (1.0 - w_science * neighbor(science.astype(np.float64), dr, dc, 0.0))
        out[k] = energy[k] * factor
    return out
