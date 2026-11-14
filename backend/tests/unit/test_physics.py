import math

from senda.domain.services.physics import o2_liters, pandolf_watts


def test_load_increases_metabolic_rate():
    assert pandolf_watts(80, 30, 1.0, 5) > pandolf_watts(80, 0, 1.0, 5)


def test_o2_conversion():
    assert math.isclose(o2_liters(20.1), 1.0)
