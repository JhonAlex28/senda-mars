"""Reserva de O2, punto de no retorno (PNR) y reglas de alerta (doc §6.5). Puras."""
from __future__ import annotations

import math
from dataclasses import dataclass

SEVERITY = {"info": 0, "caution": 1, "rtb": 2}


@dataclass(frozen=True)
class Alert:
    level: str      # info | caution | rtb
    code: str
    msg: str


def reserve_series(o2_left_l: list[float], return_o2_l: list[float],
                   safety_factor: float, consumption_multiplier: float = 1.0) -> list[float]:
    """reserve(k) = O2_left(k) − O2_para_volver(k)·factor·multiplicador."""
    return [left - ret * safety_factor * consumption_multiplier
            for left, ret in zip(o2_left_l, return_o2_l)]


def pnr_index(reserve: list[float]) -> int | None:
    """Primer índice con reserva negativa (no se puede volver con margen)."""
    for k, r in enumerate(reserve):
        if r < 0 or math.isinf(r) or math.isnan(r):
            return k
    return None


@dataclass(frozen=True)
class EvaState:
    reserve_l: float
    capacity_l: float
    caution_fraction: float
    elapsed_min: float
    return_time_min: float
    max_duration_min: float
    dose_msv: float
    dose_budget_msv: float
    sep_active: bool
    slope_ahead: bool
    confidence: float
    shelter_name: str = "SEV"


def evaluate_alerts(s: EvaState) -> Alert | None:
    """Devuelve la alerta de mayor severidad (o None si todo está nominal)."""
    alerts: list[Alert] = []
    if s.reserve_l <= 0 or math.isinf(s.return_time_min):
        alerts.append(Alert("rtb", "PNR_REACHED", "Return reserve exhausted: return to the SEV now."))
    if s.sep_active:
        alerts.append(Alert("rtb", "SEP_EVENT", f"Solar particle event: go to shelter ({s.shelter_name})."))
    if s.elapsed_min + s.return_time_min >= s.max_duration_min:
        alerts.append(Alert("rtb", "WINDOW_END", "EVA window closing: start return now."))
    elif s.elapsed_min + s.return_time_min >= 0.85 * s.max_duration_min:
        alerts.append(Alert("caution", "WINDOW_END", "EVA window closing soon."))
    if 0 < s.reserve_l < s.caution_fraction * s.capacity_l:
        alerts.append(Alert("caution", "RESERVE_LOW", "O2 return reserve below caution threshold."))
    if s.dose_msv > s.dose_budget_msv:
        alerts.append(Alert("caution", "DOSE_HIGH", "EVA dose above nominal budget."))
    if s.slope_ahead:
        alerts.append(Alert("info", "SLOPE_AHEAD", "Caution slope (10–20°) within 20 m."))
    if s.confidence < 0.5:
        alerts.append(Alert("info", "LOW_CONFIDENCE", "Terrain data interpolated here (low confidence)."))
    if not alerts:
        return None
    return max(alerts, key=lambda a: SEVERITY[a.level])
