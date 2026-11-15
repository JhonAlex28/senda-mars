"""Derivados de terreno (puros, numpy). Sirven de respaldo si Mec. A no entrega
classes/risk/confidence: con solo dem.npy + grid.json el planificador funciona."""
from __future__ import annotations

import math

import numpy as np
from scipy import ndimage

from senda.domain.models.terrain import CLASS_CAUTION, CLASS_NODATA, CLASS_NOGO, CLASS_OK

Cell = tuple[int, int]


def slope_deg(dem: np.ndarray, cell_size_m: float) -> np.ndarray:
    """Pendiente escalar por celda (grados), diferencias centrales. NaN -> NaN."""
    gy, gx = np.gradient(dem.astype(np.float64), cell_size_m)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def classify_slope(dem: np.ndarray, cell_size_m: float,
                   caution_deg: float, nogo_deg: float) -> np.ndarray:
    s = slope_deg(dem, cell_size_m)
    cls = np.full(dem.shape, CLASS_OK, dtype=np.uint8)
    cls[s >= caution_deg] = CLASS_CAUTION
    cls[s > nogo_deg] = CLASS_NOGO
    cls[~np.isfinite(dem)] = CLASS_NODATA
    return cls


def derive_risk(dem: np.ndarray, cell_size_m: float, nogo_deg: float) -> np.ndarray:
    """Riesgo [0,1] = 0.6·pendiente normalizada + 0.4·rugosidad (TRI) normalizada."""
    s = slope_deg(dem, cell_size_m)
    z = np.nan_to_num(dem.astype(np.float64), nan=float(np.nanmean(dem)))
    pad = np.pad(z, 1, mode="edge")
    tri = np.zeros_like(z)
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            tri += np.abs(pad[1 + dr:1 + dr + z.shape[0], 1 + dc:1 + dc + z.shape[1]] - z)
    tri /= 8.0
    tri_ref = cell_size_m * math.tan(math.radians(nogo_deg))
    risk = 0.6 * np.clip(s / nogo_deg, 0, 1) + 0.4 * np.clip(tri / tri_ref, 0, 1)
    risk[~np.isfinite(dem)] = 1.0
    return np.nan_to_num(risk, nan=1.0).astype(np.float32)


def default_confidence(dem: np.ndarray) -> np.ndarray:
    return np.where(np.isfinite(dem), 1.0, 0.0).astype(np.float32)


def nogo_mask(classes: np.ndarray, dilation_cells: int) -> np.ndarray:
    """Máscara de celdas prohibidas (clase 2 o sin datos), dilatada como margen."""
    mask = (classes == CLASS_NOGO) | (classes == CLASS_NODATA)
    if dilation_cells > 0 and mask.any():
        mask = ndimage.binary_dilation(mask, iterations=dilation_cells)
    return mask


def science_raster(shape: tuple[int, int], cell_size_m: float,
                   targets: list[tuple[Cell, float]], radius_m: float) -> np.ndarray:
    """science[r,c] ∈ [0,1]: máximo S de los objetivos en un radio `radius_m`."""
    sci = np.zeros(shape, dtype=np.float32)
    rad = max(1, int(math.ceil(radius_m / cell_size_m)))
    for (r, c), s in targets:
        r0, r1 = max(0, r - rad), min(shape[0], r + rad + 1)
        c0, c1 = max(0, c - rad), min(shape[1], c + rad + 1)
        if r0 >= r1 or c0 >= c1:
            continue
        rr, cc = np.ogrid[r0:r1, c0:c1]
        disk = (rr - r) ** 2 + (cc - c) ** 2 <= rad ** 2
        sub = sci[r0:r1, c0:c1]
        sub[disk] = np.maximum(sub[disk], s)
    return sci


def snap_to_passable(cell: Cell, blocked: np.ndarray, max_radius_cells: int = 25) -> Cell | None:
    """Celda transitable más cercana (búsqueda por anillos). None si no hay."""
    rows, cols = blocked.shape
    r, c = cell
    if 0 <= r < rows and 0 <= c < cols and not blocked[r, c]:
        return cell
    best: tuple[float, Cell] | None = None
    for rad in range(1, max_radius_cells + 1):
        for dr in range(-rad, rad + 1):
            for dc in (-rad, rad) if abs(dr) != rad else range(-rad, rad + 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < rows and 0 <= cc < cols and not blocked[rr, cc]:
                    d = dr * dr + dc * dc
                    if best is None or d < best[0]:
                        best = (d, (rr, cc))
        if best is not None:
            return best[1]
    return None


def downsample(grid, factor: int):
    """Agrega bloques factor×factor de forma CONSERVADORA para planificar más rápido
    (doc §6.3): dem = media, clase = la peor (no-go si algún píxel es no-go),
    riesgo = máximo, confianza = mínima."""
    from dataclasses import replace as _replace

    from senda.domain.models.grid import GridSpec

    if factor <= 1:
        return grid
    rows, cols = grid.spec.rows // factor, grid.spec.cols // factor
    f = factor

    def blocks(a: np.ndarray) -> np.ndarray:
        return a[:rows * f, :cols * f].reshape(rows, f, cols, f).swapaxes(1, 2).reshape(rows, cols, f * f)

    dem_b = blocks(grid.dem.astype(np.float64))
    finite = np.isfinite(dem_b)
    count = finite.sum(axis=2)
    dem = np.where(count > 0, np.where(finite, dem_b, 0.0).sum(axis=2) / np.maximum(count, 1), np.nan)
    cls_b = blocks(grid.classes)
    valid = np.where(cls_b == CLASS_NODATA, 0, cls_b)
    classes = valid.max(axis=2).astype(np.uint8)
    classes[np.all(cls_b == CLASS_NODATA, axis=2)] = CLASS_NODATA
    spec = GridSpec(origin_x=grid.spec.origin_x, origin_y=grid.spec.origin_y,
                    cell_size_m=grid.spec.cell_size_m * f, rows=rows, cols=cols, radius_m=grid.spec.radius_m)
    return _replace(grid, spec=spec, dem=dem.astype(np.float32), classes=classes,
                    risk=blocks(grid.risk).max(axis=2).astype(np.float32),
                    confidence=blocks(grid.confidence).min(axis=2).astype(np.float32))
