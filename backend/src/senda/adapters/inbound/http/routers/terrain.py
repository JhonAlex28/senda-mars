from fastapi import APIRouter, Depends, Query

from senda.adapters.inbound.http.dependencies import get_terrain_uc
from senda.adapters.inbound.http.schemas import BBoxDto, TerrainOut
from senda.application.use_cases.terrain import GetTerrain

router = APIRouter(prefix="/terrain", tags=["terrain"])


@router.get("", response_model=TerrainOut)
def get_terrain(
    cell_size_m: float = Query(16.0, ge=2.0, le=100.0),
    min_lon: float | None = None,
    min_lat: float | None = None,
    max_lon: float | None = None,
    max_lat: float | None = None,
    uc: GetTerrain = Depends(get_terrain_uc),
) -> TerrainOut:
    """Elevación y pendiente del sitio completo, o de una ventana si se envían los 4 límites."""
    corners = (min_lon, min_lat, max_lon, max_lat)
    bbox = None
    if all(v is not None for v in corners):
        bbox = BBoxDto(min_lon=min_lon, min_lat=min_lat, max_lon=max_lon, max_lat=max_lat).to_domain()
    return TerrainOut.from_domain(uc.execute(cell_size_m, bbox))
