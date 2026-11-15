"""Simulación de la EVA (S-3, S-4, S-6): reproduce la ruta celda por celda, evalúa
reglas y, ante una alerta `rtb`, desvía a la tripulación al refugio (replanificación)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from senda.domain.models.params import SOL_S, ProfileWeights
from senda.domain.models.route import EvaRoute
from senda.domain.models.terrain import CLASS_CAUTION
from senda.domain.services.eva_planner import EvaContext
from senda.domain.services.grid_graph import direction_of
from senda.domain.services.pathfinding import grid_astar
from senda.domain.services.safety_rules import Alert, EvaState, evaluate_alerts
from senda.domain.services.scenarios import ScenarioEffect

Cell = tuple[int, int]
MAX_ROWS = 500


@dataclass(frozen=True)
class Shelter:
    id: str
    cell: Cell
    return_o2: np.ndarray          # L para llegar a este refugio desde cada celda


@dataclass(frozen=True)
class SimRow:
    t_min: float
    cell: Cell
    progress: float
    o2_left_l: float
    return_o2_l: float
    reserve_l: float
    dose_msv: float
    next_wp: str | None
    dist_left_m: float
    alert: Alert | None


@dataclass
class SimulationResult:
    rows: list[SimRow]
    cells: list[Cell]
    diverted_at_index: int | None = None
    diverted_to: str | None = None
    diverted_path: list[Cell] = field(default_factory=list)


def simulate_eva(nominal: EvaContext, scenario_ctx: EvaContext, effect: ScenarioEffect,
                 plan: EvaRoute, at_index: int, return_weights: ProfileWeights,
                 max_duration_min: float, staging_id: str,
                 shelters: list[Shelter] | None = None) -> SimulationResult:
    p = nominal.params
    cs = nominal.terrain.spec.cell_size_m
    path = list(plan.cells)
    stops = {s.path_index: s for s in plan.stops}
    wp_marks = sorted([(s.path_index, s.target_id) for s in plan.stops] + [(len(path) - 1, staging_id)])
    ahead_cells = max(1, int(20.0 / cs))
    shelters = shelters or []

    rows: list[SimRow] = []
    t_s = used_kj = dose = 0.0
    walked = 0.0
    total_len = _length(path, cs)
    diverted_at: int | None = None
    diverted_to: str | None = None
    diverted_path: list[Cell] = []
    k = 0
    while True:
        cell = path[k]
        active = k >= at_index
        ctx = scenario_ctx if active else nominal
        mult = effect.o2_multiplier if active else 1.0
        if k in stops and diverted_at is None:
            st = stops[k]
            used_kj += st.energy_kj * mult
            t_s += st.task_min * 60.0
            dose += _dose_rate(p.dose_msv_per_sol, p.sep_dose_rate_msv_per_h, effect, active) \
                * st.task_min * 60.0 * (1 - st.shielding_pct / 100.0)

        o2_left = p.o2_capacity_l - used_kj / p.kj_per_l_o2   # used_kj ya incluye el multiplicador
        ret_o2 = float(ctx.return_o2[cell])
        shelter_name = staging_id
        if effect.sep_active and active:
            for sh in shelters:
                if float(sh.return_o2[cell]) < ret_o2:
                    ret_o2, shelter_name = float(sh.return_o2[cell]), sh.id
        reserve = o2_left - ret_o2 * p.return_safety_factor * mult
        ret_t_min = float(ctx.return_time_s[cell]) / 60.0
        nxt = next((wid for idx, wid in wp_marks if idx > k), None)
        upcoming = path[k + 1:k + 1 + ahead_cells]
        slope_ahead = any(nominal.terrain.classes[c] == CLASS_CAUTION for c in upcoming)
        alert = evaluate_alerts(EvaState(
            reserve_l=reserve, capacity_l=p.o2_capacity_l,
            caution_fraction=p.caution_margin_threshold, elapsed_min=t_s / 60.0,
            return_time_min=ret_t_min, max_duration_min=max_duration_min, dose_msv=dose,
            dose_budget_msv=p.eva_dose_budget_msv, sep_active=effect.sep_active and active,
            slope_ahead=slope_ahead, confidence=float(nominal.terrain.confidence[cell]),
            shelter_name=shelter_name))

        row = SimRow(t_min=t_s / 60.0, cell=cell, progress=min(1.0, walked / total_len) if total_len else 1.0,
                     o2_left_l=o2_left, return_o2_l=ret_o2, reserve_l=reserve, dose_msv=dose,
                     next_wp=diverted_to or nxt, dist_left_m=max(0.0, total_len - walked), alert=alert)
        rows.append(row)

        # Ante rtb: desviar una sola vez al refugio más barato (S-6).
        if (alert is not None and alert.level == "rtb" and diverted_at is None
                and k < len(path) - 1):
            target_id, target_cell = staging_id, nominal.staging
            if alert.code == "SEP_EVENT":
                for sh in shelters:
                    if sh.id == shelter_name:
                        target_id, target_cell = sh.id, sh.cell
            back, _ = grid_astar(scenario_ctx.search(return_weights), cell, target_cell,
                                 scenario_ctx.h_per_cell(return_weights))
            if back:
                path = path[:k + 1] + back[1:]
                diverted_at, diverted_to, diverted_path = k, target_id, back
                total_len = walked + _length(back, cs)
                wp_marks = [(len(path) - 1, target_id)]

        if k == len(path) - 1:
            break
        a, b = path[k], path[k + 1]
        d = direction_of(a, b)
        step_ctx = scenario_ctx if k >= at_index else nominal
        e = float(step_ctx.energy[d, a[0], a[1]])
        dt = float(step_ctx.time[d, a[0], a[1]])
        if math.isinf(e):          # p. ej. celda bloqueada: usar costo nominal
            e = float(nominal.energy[d, a[0], a[1]])
            dt = float(nominal.time[d, a[0], a[1]])
        used_kj += e * (effect.o2_multiplier if k >= at_index else 1.0)
        t_s += dt
        dose += _dose_rate(p.dose_msv_per_sol, p.sep_dose_rate_msv_per_h, effect, k >= at_index) * dt
        walked += cs * (math.sqrt(2) if a[0] != b[0] and a[1] != b[1] else 1.0)
        k += 1

    return SimulationResult(rows=_sample(rows), cells=path, diverted_at_index=diverted_at,
                            diverted_to=diverted_to, diverted_path=diverted_path)


def _dose_rate(gcr_per_sol: float, sep_per_h: float, effect: ScenarioEffect, active: bool) -> float:
    rate = gcr_per_sol / SOL_S
    if effect.sep_active and active:
        rate += sep_per_h / 3600.0
    return rate


def _length(path: list[Cell], cs: float) -> float:
    return sum(cs * (math.sqrt(2) if a[0] != b[0] and a[1] != b[1] else 1.0)
               for a, b in zip(path, path[1:]))


def _sample(rows: list[SimRow]) -> list[SimRow]:
    """≤ MAX_ROWS filas; siempre conserva cambios de alerta y la última fila."""
    if len(rows) <= MAX_ROWS:
        return rows
    step = math.ceil(len(rows) / (MAX_ROWS * 0.8))
    keep: list[SimRow] = []
    prev = object()
    for i, r in enumerate(rows):
        code = r.alert.code if r.alert else None
        if i % step == 0 or code != prev or i == len(rows) - 1:
            keep.append(r)
        prev = code
    return keep
