"""Análisis de terreno: funciones puras sobre matrices de elevación."""
from __future__ import annotations

import math


def slope_deg(elevation: list[list[float]], cell_size_m: float) -> list[list[float]]:
    """Pendiente por diferencias centrales (diferencias simples en los bordes)."""
    rows, cols = len(elevation), len(elevation[0])
    out = [[0.0] * cols for _ in range(rows)]
    for r in range(rows):
        r0, r1 = max(r - 1, 0), min(r + 1, rows - 1)
        for c in range(cols):
            c0, c1 = max(c - 1, 0), min(c + 1, cols - 1)
            dzdx = (elevation[r][c1] - elevation[r][c0]) / ((c1 - c0) * cell_size_m)
            dzdy = (elevation[r1][c] - elevation[r0][c]) / ((r1 - r0) * cell_size_m)
            out[r][c] = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
    return out
