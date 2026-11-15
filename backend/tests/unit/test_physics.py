import math

from senda.domain.services.metabolic import o2_liters, pandolf_watts


def test_load_increases_metabolic_rate():
    assert pandolf_watts(80, 30, 1.0, 5) > pandolf_watts(80, 0, 1.0, 5)


def test_o2_conversion():
    assert math.isclose(o2_liters(20.1), 1.0)


def test_basal_not_scaled_by_gravity():
    # Con V = 0 y sin carga solo queda el basal 1.5·W, multiplicado por el traje.
    assert math.isclose(pandolf_watts(75, 0, 0.0, 0, g_ratio=0.38, suit_multiplier=1.25), 1.25 * 1.5 * 75)


def test_uphill_costs_more_than_flat():
    assert pandolf_watts(75, 45, 0.75, 10) > 1.5 * pandolf_watts(75, 45, 0.75, 0)
