"""Parámetros del modelo (inmutables). Se cargan desde env.json + mission_params.json.

Cada valor supuesto se declara en `assumptions()` con su `kind` y fuente para que la
UI lo muestre (doc §1, "supuestos visibles").
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from senda.domain.models.route import RouteProfile

EARTH_G = 9.80665
MARS_G = 3.721
SOL_S = 88_775.244          # duración de un sol (s)
MARS_HOUR_S = SOL_S / 24.0  # 1 "hora" LTST (s)


@dataclass(frozen=True)
class ProfileWeights:
    w_risk: float
    w_science: float


@dataclass(frozen=True)
class EvaParams:
    body_kg: float = 75.0
    load_kg: float = 45.0                    # traje + PLSS
    g_ratio: float = MARS_G / EARTH_G        # 0.3794
    suit_multiplier: float = 1.25
    terrain_factor_eta: float = 1.2
    v_nominal_m_s: float = 0.75
    caution_speed_factor: float = 0.6
    stop_rate_w: float = 220.0
    kj_per_l_o2: float = 20.1
    o2_capacity_l: float = 300.0
    return_safety_factor: float = 1.3
    caution_margin_threshold: float = 0.20
    suit_leak_multiplier: float = 1.5
    injury_speed_multiplier: float = 0.5
    dust_storm_speed_factor: float = 0.70
    dose_msv_per_sol: float = 0.64
    sep_dose_rate_msv_per_h: float = 15.0
    eva_dose_budget_msv: float = 0.15
    science_radius_m: float = 15.0
    nogo_dilation_cells: int = 1
    slope_caution_deg: float = 10.0
    slope_nogo_deg: float = 20.0


@dataclass(frozen=True)
class RoverParams:
    name: str = "NASA SEV (pressurized)"
    mass_kg: float = 4000.0
    crr: float = 0.15
    drivetrain_eff: float = 0.8
    hotel_kw: float = 1.5
    battery_kwh: float = 100.0
    battery_reserve_fraction: float = 0.30
    v_nominal_kmh: float = 5.0
    v_caution_kmh: float = 3.0
    v_max_kmh: float = 10.0
    w_risk: float = 1.0
    cabin_dose_factor: float = 0.5
    slope_caution_deg: float = 15.0
    slope_nogo_deg: float = 25.0
    nogo_dilation_cells: int = 1
    no_night_drive: bool = True
    egress_min: float = 30.0                 # salida por suitports
    ingress_min: float = 30.0


@dataclass(frozen=True)
class MissionWindow:
    eva_start_h: float = 9.5
    eva_end_h: float = 15.5
    eva_max_duration_min: float = 360.0
    sunrise_h: float = 5.8
    sunset_h: float = 17.8667
    sol: int = 5074


@dataclass(frozen=True)
class MissionParams:
    base_lonlat: tuple[float, float]
    eva: EvaParams
    rover: RoverParams
    window: MissionWindow
    profiles: dict[RouteProfile, ProfileWeights]
    assumption_table: dict[str, dict[str, Any]] = field(default_factory=dict)

    def assumptions(self) -> dict[str, dict[str, Any]]:
        return dict(self.assumption_table)


DEFAULT_PROFILES: dict[RouteProfile, ProfileWeights] = {
    RouteProfile.SAFE: ProfileWeights(w_risk=3.5, w_science=0.1),
    RouteProfile.FAST: ProfileWeights(w_risk=0.0, w_science=0.0),
    RouteProfile.SCIENTIFIC: ProfileWeights(w_risk=1.0, w_science=0.5),
}
