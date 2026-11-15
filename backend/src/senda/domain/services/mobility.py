"""Modelos de movilidad: cuánto tarda y cuánto recurso consume moverse por el terreno.
Un modelo para el rover (batería) y otro para el astronauta en EVA (oxígeno).
Los valores del rover son supuestos de diseño; los de la EVA vienen de env.json (physiology)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from senda.domain.models.route import Conditions, TravelMode
from senda.domain.services.physics import MARS_G, o2_liters, pandolf_watts

CAUTION_SLOPE_DEG = 10.0      # env.json terrain_classes.caution
RETURN_SAFETY_FACTOR = 1.3    # env.json physiology.return_safety_factor
RESERVE_FRACTION = 0.20       # env.json physiology.caution_margin_threshold


class MobilityModel(Protocol):
    mode: TravelMode
    max_slope_deg: float
    resource_name: str
    resource_unit: str
    capacity: float

    def speed_m_s(self, slope_deg: float) -> float: ...
    def step_resource(self, distance_m: float, climb_m: float, seconds: float,
                      conditions: Conditions) -> float: ...
    def dwell_resource(self, minutes: float, conditions: Conditions) -> float: ...


def slope_risk(slope_deg: float, max_slope_deg: float) -> float:
    """0 en terreno transitable; crece hasta 1 en el límite infranqueable."""
    if slope_deg <= CAUTION_SLOPE_DEG:
        return 0.0
    return min(1.0, (slope_deg - CAUTION_SLOPE_DEG) / (max_slope_deg - CAUTION_SLOPE_DEG))


def return_is_safe(used: float, capacity: float) -> bool:
    """Hay margen para volver: el consumo × factor de seguridad no toca la reserva."""
    return used * RETURN_SAFETY_FACTOR <= capacity * (1 - RESERVE_FRACTION)


@dataclass(frozen=True)
class RoverModel:
    """Rover presurizado (supuesto)."""
    mode: TravelMode = TravelMode.ROVER
    max_slope_deg: float = 18.0
    resource_name: str = "battery"
    resource_unit: str = "kWh"
    capacity: float = 30.0
    nominal_speed_m_s: float = 2.5
    mass_kg: float = 3000.0
    rolling_kwh_per_km: float = 0.35
    drivetrain_efficiency: float = 0.8
    hotel_load_kw: float = 0.4

    def speed_m_s(self, slope_deg: float) -> float:
        return self.nominal_speed_m_s * max(0.25, 1 - slope_deg / 25)

    def step_resource(self, distance_m: float, climb_m: float, seconds: float,
                      conditions: Conditions) -> float:
        climb_kwh = max(0.0, climb_m) * self.mass_kg * MARS_G / 3.6e6 / self.drivetrain_efficiency
        rolling_kwh = distance_m / 1000 * self.rolling_kwh_per_km
        return rolling_kwh + climb_kwh + self.dwell_resource(seconds / 60, conditions)

    def dwell_resource(self, minutes: float, conditions: Conditions) -> float:
        return self.hotel_load_kw * minutes / 60


@dataclass(frozen=True)
class EvaModel:
    """Astronauta con traje y PLSS."""
    mode: TravelMode = TravelMode.EVA
    max_slope_deg: float = 20.0
    resource_name: str = "oxygen"
    resource_unit: str = "L"
    capacity: float = 300.0
    nominal_speed_m_s: float = 0.75
    body_kg: float = 75.0
    load_kg: float = 45.0
    science_watts: float = 220.0

    def speed_m_s(self, slope_deg: float) -> float:
        return self.nominal_speed_m_s * max(0.3, 1 - slope_deg / 30)

    def step_resource(self, distance_m: float, climb_m: float, seconds: float,
                      conditions: Conditions) -> float:
        if not seconds:
            return 0.0
        grade_pct = max(0.0, 100 * climb_m / distance_m)
        watts = pandolf_watts(self.body_kg, self.load_kg, distance_m / seconds, grade_pct)
        return o2_liters(watts * seconds / 1000) * conditions.o2_multiplier

    def dwell_resource(self, minutes: float, conditions: Conditions) -> float:
        return o2_liters(self.science_watts * minutes * 60 / 1000) * conditions.o2_multiplier


def model_for(mode: TravelMode) -> MobilityModel:
    return RoverModel() if mode is TravelMode.ROVER else EvaModel()


ROVER_SPECS: dict[str, dict[str, float]] = {
    "SEV_PRESSURIZED": {"capacity": 42.0, "speed_kmh": 8.0, "mass_kg": 3000.0, "hotel_load_kw": 0.45},
    "LTV_UNPRESSURIZED": {"capacity": 18.0, "speed_kmh": 12.0, "mass_kg": 1200.0, "hotel_load_kw": 0.15},
    "HYBRID_ROVER": {"capacity": 28.0, "speed_kmh": 10.0, "mass_kg": 2100.0, "hotel_load_kw": 0.25},
}


def rover_model_for(vehicle_id: str | None = None, speed_kmh: float | None = None) -> RoverModel:
    spec = ROVER_SPECS.get(vehicle_id or "SEV_PRESSURIZED", ROVER_SPECS["SEV_PRESSURIZED"])
    spd = max(1.0, float(speed_kmh if speed_kmh is not None else spec["speed_kmh"]))
    return RoverModel(
        capacity=spec["capacity"],
        nominal_speed_m_s=spd / 3.6,
        mass_kg=spec["mass_kg"],
        hotel_load_kw=spec["hotel_load_kw"],
    )
