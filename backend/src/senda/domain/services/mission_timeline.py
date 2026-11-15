"""Timeline por sol (M-2): reparte manejo, pernocte y EVA respetando la ventana EVA
y la regla de no manejar de noche. Horas en LTST (0–24 "horas marcianas")."""
from __future__ import annotations

from senda.domain.models.mission import SolActivity, Warning
from senda.domain.models.params import MARS_HOUR_S, MissionWindow, RoverParams
from senda.domain.models.route import RouteProfile


def _drive(sol: int, t: float, duration_h: float, w: MissionWindow, rover: RoverParams,
           label: str, out: list[SolActivity], warnings: list[Warning]) -> tuple[int, float]:
    """Maneja `duration_h`; si llega la noche, pernocta y sigue al amanecer."""
    remaining = duration_h
    if rover.no_night_drive and (t < w.sunrise_h or t >= w.sunset_h):
        if t >= w.sunset_h:
            out.append(SolActivity(sol, t, 24.0, "overnight"))
            sol += 1
        t = w.sunrise_h
    while remaining > 1e-9:
        limit = w.sunset_h if rover.no_night_drive else 24.0
        chunk = min(remaining, limit - t)
        out.append(SolActivity(sol, t, t + chunk, label))
        t += chunk
        remaining -= chunk
        if remaining > 1e-9:
            warnings.append(Warning("NIGHT_DRIVE_AVOIDED",
                                    f"{label} split across sols to avoid driving after sunset."))
            out.append(SolActivity(sol, t, 24.0, "overnight"))
            sol += 1
            t = w.sunrise_h
    return sol, t


def build_timeline(w: MissionWindow, rover: RoverParams, depart_sol: int, depart_h: float,
                   drive_out_s: float, eva_min: float, drive_back_s: float,
                   profile: RouteProfile) -> tuple[list[SolActivity], list[Warning]]:
    out: list[SolActivity] = []
    warnings: list[Warning] = []
    sol, t = _drive(depart_sol, depart_h, drive_out_s / MARS_HOUR_S, w, rover, "drive_out", out, warnings)

    egress_h = rover.egress_min / 60.0
    ingress_h = rover.ingress_min / 60.0
    eva_h = eva_min / 60.0
    if eva_min > w.eva_max_duration_min or eva_h > (w.eva_end_h - w.eva_start_h):
        warnings.append(Warning("EVA_TOO_LONG", "EVA exceeds the EVA window; reduce targets."))
    start = max(t + egress_h, w.eva_start_h)
    if start + eva_h > w.eva_end_h:
        # No cabe hoy: pernocte en el SEV y EVA al sol siguiente.
        out.append(SolActivity(sol, t, 24.0, "overnight"))
        sol += 1
        start = w.eva_start_h
        t = start - egress_h
    if start - egress_h > t:
        out.append(SolActivity(sol, t, start - egress_h, "standby"))
    out.append(SolActivity(sol, start - egress_h, start, "egress"))
    out.append(SolActivity(sol, start, start + eva_h, "eva", profile))
    t = start + eva_h
    out.append(SolActivity(sol, t, t + ingress_h, "ingress"))
    t += ingress_h

    sol, t = _drive(sol, t, drive_back_s / MARS_HOUR_S, w, rover, "drive_back", out, warnings)
    return out, warnings


def ltst_to_hours(ltst: str) -> float:
    hh, mm = ltst.split(":")
    return int(hh) + int(mm) / 60.0


def hours_to_ltst(h: float) -> str:
    total = int(round(h * 60))
    if total >= 24 * 60:
        return "24:00"
    return f"{total // 60:02d}:{total % 60:02d}"
