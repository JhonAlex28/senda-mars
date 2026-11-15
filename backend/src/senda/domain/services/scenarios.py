"""Escenarios de contingencia (S-5) y sus efectos sobre el modelo (doc §6.6)."""
from __future__ import annotations

from dataclasses import dataclass

from senda.domain.models.params import EvaParams


@dataclass(frozen=True)
class Scenario:
    id: str
    label: str
    effect: str
    kind: str = "supuesto"


@dataclass(frozen=True)
class ScenarioEffect:
    speed_factor: float = 1.0
    o2_multiplier: float = 1.0
    risk_multiplier: float = 1.0
    sep_active: bool = False
    blocked_path: bool = False


SCENARIOS: dict[str, Scenario] = {s.id: s for s in [
    Scenario("none", "Nominal", "No contingency."),
    Scenario("dust_storm", "Dust storm",
             "Walking speed × dust_storm_speed_factor (0.70) and terrain risk × 1.5 (env.json → dust)."),
    Scenario("sep_event", "Solar particle event",
             "Dose rate + unshielded SEP rate (env.json → radiation.solar_storm); return to shelter.",
             kind="modelado"),
    Scenario("suit_leak", "Suit leak", "O2 consumption × suit_leak_multiplier (1.5) from the event on."),
    Scenario("injury", "Crew injury", "Walking speed × injury_speed_multiplier (0.5) from the event on."),
    Scenario("blocked_path", "Blocked path",
             "Terrain ahead becomes no-go (10 m radius) → replanning from the current position."),
]}


def effect_of(scenario_id: str, p: EvaParams) -> ScenarioEffect:
    if scenario_id not in SCENARIOS:
        raise KeyError(scenario_id)
    return {
        "none": ScenarioEffect(),
        "dust_storm": ScenarioEffect(speed_factor=p.dust_storm_speed_factor, risk_multiplier=1.5),
        "sep_event": ScenarioEffect(sep_active=True),
        "suit_leak": ScenarioEffect(o2_multiplier=p.suit_leak_multiplier),
        "injury": ScenarioEffect(speed_factor=p.injury_speed_multiplier),
        "blocked_path": ScenarioEffect(blocked_path=True),
    }[scenario_id]
