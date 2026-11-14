"""Propuesta de puntos de estacionamiento del rover. Sin I/O.

Agrupa los objetivos (en orden de prioridad) en zonas que se recorren a pie y,
para cada zona, busca una celda plana cercana donde el rover pueda detenerse."""
from __future__ import annotations

from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import ParkingSpot
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import Cell, TerrainGrid
from senda.domain.services.mobility import CAUTION_SLOPE_DEG

EVA_RADIUS_M = 300.0       # distancia máxima a pie entre objetivos de una misma zona
STANDOFF_M = 70.0          # el rover no entra al afloramiento: se estaciona a una caminata corta
SEARCH_RADIUS_M = 250.0


def group_by_walking_zone(targets: list[ScienceTarget]) -> list[list[ScienceTarget]]:
    """Agrupación voraz: cada zona empieza en el objetivo pendiente de mayor prioridad."""
    pending = list(targets)
    zones: list[list[ScienceTarget]] = []
    while pending:
        lead = pending[0]
        zone = [t for t in pending if t.location.distance_to(lead.location) <= EVA_RADIUS_M]
        zones.append(zone)
        pending = [t for t in pending if t not in zone]
    return zones


def _centroid(points: list[GeoPoint]) -> GeoPoint:
    n = len(points)
    return GeoPoint(sum(p.lon for p in points) / n, sum(p.lat for p in points) / n)


def _parking_location(grid: TerrainGrid, zone: list[ScienceTarget], blocked: set[Cell]) -> GeoPoint:
    """Celda plana y libre más cercana al centro de la zona, sin pisar los objetivos."""
    center = _centroid([t.location for t in zone])
    cr, cc = grid.cell_of(center)
    reach = int(SEARCH_RADIUS_M / grid.cell_size_m)
    best, best_d = center, float("inf")
    for r in range(max(cr - reach, 0), min(cr + reach + 1, grid.rows)):
        for c in range(max(cc - reach, 0), min(cc + reach + 1, grid.cols)):
            if (r, c) in blocked or grid.slope((r, c)) > CAUTION_SLOPE_DEG:
                continue
            p = grid.point_of((r, c))
            if min(p.distance_to(t.location) for t in zone) < STANDOFF_M:
                continue
            d = p.distance_to(center)
            if d < best_d:
                best, best_d = p, d
    return best


def propose_parkings(grid: TerrainGrid, targets: list[ScienceTarget],
                     blocked: set[Cell]) -> list[ParkingSpot]:
    return [
        ParkingSpot(f"P{i}", _parking_location(grid, zone, blocked), [t.id for t in zone])
        for i, zone in enumerate(group_by_walking_zone(targets), start=1)
    ]
