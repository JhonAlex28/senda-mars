"""A* genérico sobre grilla de costos (8 vecinos). Sin I/O."""
from __future__ import annotations

import heapq
import math
from typing import Callable

Cell = tuple[int, int]
StepCost = Callable[[Cell, Cell], float]   # math.inf si el paso es intransitable
Heuristic = Callable[[Cell, Cell], float]

_NEIGHBORS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def octile(a: Cell, b: Cell) -> float:
    dr, dc = abs(a[0] - b[0]), abs(a[1] - b[1])
    return max(dr, dc) + (math.sqrt(2) - 1) * min(dr, dc)


def astar(rows: int, cols: int, start: Cell, goal: Cell,
          step_cost: StepCost, heuristic: Heuristic = octile) -> tuple[list[Cell], float]:
    """Devuelve (camino, costo). Camino vacío y costo inf si no hay ruta.
    Con heuristic=lambda a, b: 0 se comporta como Dijkstra."""
    open_heap: list[tuple[float, float, Cell]] = [(heuristic(start, goal), 0.0, start)]
    g: dict[Cell, float] = {start: 0.0}
    parent: dict[Cell, Cell] = {}
    while open_heap:
        _, cost, cur = heapq.heappop(open_heap)
        if cur == goal:
            path = [cur]
            while cur in parent:
                cur = parent[cur]
                path.append(cur)
            return path[::-1], cost
        if cost > g.get(cur, math.inf):
            continue
        for dr, dc in _NEIGHBORS:
            nxt = (cur[0] + dr, cur[1] + dc)
            if not (0 <= nxt[0] < rows and 0 <= nxt[1] < cols):
                continue
            new_cost = cost + step_cost(cur, nxt)
            if new_cost < g.get(nxt, math.inf):
                g[nxt] = new_cost
                parent[nxt] = cur
                heapq.heappush(open_heap, (new_cost + heuristic(nxt, goal), new_cost, nxt))
    return [], math.inf


# --------------------------------------------------------------------------
# A* rápido sobre arrays por dirección (8, rows, cols) — usado por el planner.
# --------------------------------------------------------------------------
import numpy as _np  # noqa: E402

from senda.domain.services.grid_graph import DIRS as _DIRS  # noqa: E402

_SQRT2_M1 = math.sqrt(2) - 1


def grid_astar(costs: "_np.ndarray", start: Cell, goal: Cell,
               h_per_cell: float) -> tuple[list[Cell], float]:
    """A* sobre `costs[k, r, c]` (costo de (r,c) -> vecino k; inf = inválido).

    `h_per_cell` = cota inferior del costo por longitud de celda (heurística
    octil admisible). Con h_per_cell = 0 es Dijkstra. Devuelve ([], inf) si no hay ruta.
    """
    _, rows, cols = costs.shape
    flat = [memoryview(_np.ascontiguousarray(costs[k], dtype=_np.float64).reshape(-1))
            for k in range(8)]
    offsets = [dr * cols + dc for dr, dc in _DIRS]
    s = start[0] * cols + start[1]
    gidx = goal[0] * cols + goal[1]
    gr, gc = goal

    def h(idx: int) -> float:
        r, c = divmod(idx, cols)
        dr, dc = abs(r - gr), abs(c - gc)
        return h_per_cell * (max(dr, dc) + _SQRT2_M1 * min(dr, dc))

    g: dict[int, float] = {s: 0.0}
    parent: dict[int, int] = {}
    closed: set[int] = set()
    heap: list[tuple[float, float, int]] = [(h(s), 0.0, s)]
    while heap:
        _, cost, cur = heapq.heappop(heap)
        if cur in closed:
            continue
        if cur == gidx:
            path = [cur]
            while cur in parent:
                cur = parent[cur]
                path.append(cur)
            return [divmod(i, cols) for i in reversed(path)], cost
        closed.add(cur)
        for k in range(8):
            w = flat[k][cur]
            if w == math.inf:
                continue
            nxt = cur + offsets[k]
            nc = cost + w
            if nc < g.get(nxt, math.inf):
                g[nxt] = nc
                parent[nxt] = cur
                heapq.heappush(heap, (nc + h(nxt), nc, nxt))
    return [], math.inf


def chain_astar(costs: "_np.ndarray", waypoints: list[Cell],
                h_per_cell: float) -> tuple[list[Cell], list[int], float]:
    """Encadena A* entre waypoints. Devuelve (camino, índice de cada waypoint en el
    camino, costo). Lanza ValueError con el tramo que falla."""
    path: list[Cell] = [waypoints[0]]
    idx = [0]
    total = 0.0
    for a, b in zip(waypoints, waypoints[1:]):
        seg, c = grid_astar(costs, a, b, h_per_cell)
        if not seg:
            raise ValueError(f"no path between {a} and {b}")
        path.extend(seg[1:])
        idx.append(len(path) - 1)
        total += c
    return path, idx, total
