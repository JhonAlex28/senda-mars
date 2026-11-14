import math

from senda.domain.services.pathfinding import astar, octile


def _cost(a, b):
    if b == (2, 2):  # obstáculo
        return math.inf
    return math.hypot(a[0] - b[0], a[1] - b[1])


def test_astar_matches_dijkstra():
    path_a, cost_a = astar(6, 6, (0, 0), (5, 5), _cost, octile)
    _, cost_d = astar(6, 6, (0, 0), (5, 5), _cost, lambda a, b: 0.0)
    assert math.isclose(cost_a, cost_d)
    assert path_a[0] == (0, 0) and path_a[-1] == (5, 5)
    assert (2, 2) not in path_a
