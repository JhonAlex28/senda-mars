"""Física de la EVA: funciones puras, sin I/O."""
from __future__ import annotations

MARS_G = 3.721               # m/s²
MARS_G_RATIO = 0.38          # gravedad de Marte relativa a la Tierra
SUIT_FACTOR = 1.25           # penalización metabólica del traje presurizado
O2_ENERGY_KJ_PER_L = 20.1    # equivalente energético del O2


def pandolf_watts(body_kg: float, load_kg: float, speed_m_s: float,
                  grade_pct: float, terrain_factor: float = 1.2) -> float:
    """Ecuación de Pandolf escalada a la gravedad marciana y al traje."""
    w, l, v, g = body_kg, load_kg, speed_m_s, grade_pct
    m = (1.5 * w + 2.0 * (w + l) * (l / w) ** 2
         + terrain_factor * (w + l) * (1.5 * v ** 2 + 0.35 * v * g))
    return m * MARS_G_RATIO * SUIT_FACTOR


def o2_liters(energy_kj: float) -> float:
    return energy_kj / O2_ENERGY_KJ_PER_L
