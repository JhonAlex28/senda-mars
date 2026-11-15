"""¿Se puede salir hoy? Evalúa las condiciones ambientales contra umbrales de EVA. Sin I/O."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from senda.domain.models.environment import EnvironmentSnapshot


class Verdict(str, Enum):
    GO = "go"
    CAUTION = "caution"
    NO_GO = "no_go"


_SEVERITY = [Verdict.GO, Verdict.CAUTION, Verdict.NO_GO]


@dataclass(frozen=True)
class Check:
    key: str
    label: str
    value: float
    unit: str
    verdict: Verdict
    source: str


@dataclass(frozen=True)
class Readiness:
    verdict: Verdict
    sol: int
    local_solar_time: str
    checks: list[Check]


def _grade(value: float, caution_at: float, no_go_at: float) -> Verdict:
    """Cuanto mayor el valor, peor."""
    if value >= no_go_at:
        return Verdict.NO_GO
    return Verdict.CAUTION if value >= caution_at else Verdict.GO


def _block(details: dict[str, Any], name: str) -> dict[str, Any]:
    block = details.get(name, {})
    return block if isinstance(block, dict) else {}


def assess(env: EnvironmentSnapshot) -> Readiness:
    temperature = _block(env.details, "temperature")
    atmosphere = _block(env.details, "atmosphere")
    dust = _block(env.details, "dust")
    radiation = _block(env.details, "radiation")

    temp = float(temperature.get("eva_window_mean_C", env.temp_min_c))
    wind = float(atmosphere.get("wind_speed_m_s", 0.0))
    tau = float(dust.get("optical_depth_tau", 0.0))
    dose = float(radiation.get("gcr_dose_mSv_per_sol", 0.0))

    checks = [
        # Más frío = peor: se gradúa el valor con signo invertido
        Check("temperature", "Cold", temp, "°C", _grade(-temp, 40, 60),
              temperature.get("source", "REMS")),
        Check("wind", "Wind", wind, "m/s", _grade(wind, 10, 20),
              atmosphere.get("source", "REMS")),
        Check("dust", "Dust", tau, "τ", _grade(tau, 1.0, float(dust.get("dust_storm_tau", 3.5))),
              dust.get("source", "Mastcam")),
        Check("radiation", "Radiation", dose, "mSv/sol", _grade(dose, 1.0, 10.0),
              radiation.get("source", "RAD")),
    ]
    verdict = max((c.verdict for c in checks), key=_SEVERITY.index)
    return Readiness(verdict, env.sol, env.local_solar_time, checks)
