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
