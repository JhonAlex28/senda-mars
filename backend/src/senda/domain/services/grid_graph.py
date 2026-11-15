"""Grafo de 8 vecinos sobre la grilla, representado con arrays por dirección.

Para cada dirección k, `arr[k, r, c]` es el valor de la arista (r, c) -> (r+dr, c+dc).
Las aristas inválidas (fuera de la grilla o prohibidas) valen `inf`.
"""
from __future__ import annotations

import math

import numpy as np

DIRS: list[tuple[int, int]] = [(-1, -1), (-1, 0), (-1, 1), (0, -1),
                               (0, 1), (1, -1), (1, 0), (1, 1)]
DIR_INDEX = {d: k for k, d in enumerate(DIRS)}
SQRT2 = math.sqrt(2.0)


def step_length(k: int, cell_size_m: float) -> float:
    dr, dc = DIRS[k]
    return cell_size_m * (SQRT2 if dr != 0 and dc != 0 else 1.0)


def neighbor(arr: np.ndarray, dr: int, dc: int, fill) -> np.ndarray:
    """out[r, c] = arr[r+dr, c+dc]; `fill` fuera de la grilla."""
    rows, cols = arr.shape
    out = np.full(arr.shape, fill, dtype=arr.dtype)
    r0, r1 = max(0, -dr), rows - max(0, dr)
    c0, c1 = max(0, -dc), cols - max(0, dc)
    if r0 < r1 and c0 < c1:
        out[r0:r1, c0:c1] = arr[r0 + dr:r1 + dr, c0 + dc:c1 + dc]
    return out


def direction_of(a: tuple[int, int], b: tuple[int, int]) -> int:
    return DIR_INDEX[(b[0] - a[0], b[1] - a[1])]


def octile_cells(a: tuple[int, int], b: tuple[int, int]) -> float:
    dr, dc = abs(a[0] - b[0]), abs(a[1] - b[1])
    return max(dr, dc) + (SQRT2 - 1.0) * min(dr, dc)
