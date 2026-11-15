"""Campo de costo de retorno: costo mínimo para llegar a `source` desde cada celda.

Dijkstra multi-destino sobre el grafo INVERTIDO (scipy.sparse.csgraph, en C):
dist[v] = min costo del camino v -> source usando los costos de arista reales.
EVA: source = staging (SEV), peso = kJ (→ L O2) y s.  Rover: source = base, peso = kWh.
"""
from __future__ import annotations

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

from senda.domain.services.grid_graph import DIRS

Cell = tuple[int, int]


def _graph(step: np.ndarray) -> csr_matrix:
    _, rows, cols = step.shape
    n = rows * cols
    src_all, dst_all, w_all = [], [], []
    rr, cc = np.mgrid[0:rows, 0:cols]
    for k, (dr, dc) in enumerate(DIRS):
        w = step[k]
        ok = np.isfinite(w)
        if not ok.any():
            continue
        r, c = rr[ok], cc[ok]
        src_all.append(r * cols + c)
        dst_all.append((r + dr) * cols + (c + dc))
        w_all.append(w[ok])
    if not w_all:
        return csr_matrix((n, n))
    return csr_matrix((np.concatenate(w_all), (np.concatenate(src_all), np.concatenate(dst_all))),
                      shape=(n, n))


def cost_to_source(step: np.ndarray, source: Cell) -> np.ndarray:
    """Array (rows, cols) con el costo de ir desde cada celda hasta `source` (inf si no hay camino)."""
    _, rows, cols = step.shape
    g = _graph(step)
    dist = dijkstra(g.T.tocsr(), directed=True, indices=source[0] * cols + source[1])
    return dist.reshape(rows, cols)


def cost_to_sources(step: np.ndarray, sources: list[Cell]) -> np.ndarray:
    """Mínimo sobre varios refugios (p. ej. SEV y T08)."""
    _, rows, cols = step.shape
    g = _graph(step).T.tocsr()
    idx = [r * cols + c for r, c in sources]
    dist = dijkstra(g, directed=True, indices=idx, min_only=True)
    return dist.reshape(rows, cols)
