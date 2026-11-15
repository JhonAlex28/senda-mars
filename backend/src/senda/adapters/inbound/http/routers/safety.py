"""Campo de retorno (metadatos + PNG) y catálogo de escenarios."""
from fastapi import APIRouter, Depends, Query, Response

from senda.adapters.inbound.http.dependencies import list_scenarios_uc, return_field_uc
from senda.adapters.inbound.http.png import field_png, mask_png
from senda.adapters.inbound.http.schemas import ReturnFieldResponse, ScenarioOut
from senda.application.use_cases.return_field import GetReturnField, ListScenarios
from senda.domain.errors import InvalidRequest
from senda.domain.models.geo import GeoPoint

router = APIRouter(tags=["safety"])
PREFIX = "/api/v1"
LON = Query(None, description="EVA: longitud del SEV estacionado (por defecto, el del boxwork)")
LAT = Query(None, description="EVA: latitud del SEV estacionado")


def _staging(lon: float | None, lat: float | None) -> GeoPoint | None:
    if (lon is None) != (lat is None):
        raise InvalidRequest("lon and lat must be given together")
    return GeoPoint(lon, lat) if lon is not None else None


@router.get("/return-field", response_model=ReturnFieldResponse)
def return_field(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                 lon: float | None = LON, lat: float | None = LAT,
                 uc: GetReturnField = Depends(return_field_uc)) -> ReturnFieldResponse:
    staging = _staging(lon, lat)
    f = uc.execute(leg, scenario, staging)
    q = f"leg={leg}&scenario={f.scenario}" + (f"&lon={lon}&lat={lat}" if staging else "")
    b = f.bbox
    return ReturnFieldResponse(leg=leg, scenario=f.scenario,
                               png_url=f"{PREFIX}/return-field/image.png?{q}",
                               safe_mask_png_url=f"{PREFIX}/return-field/safe-mask.png?{q}",
                               bbox_lonlat=(b.min_lon, b.min_lat, b.max_lon, b.max_lat),
                               unit=f.unit, max_value=round(f.max_value, 3), source_id=f.source_id)


@router.get("/return-field/image.png", response_class=Response)
def return_field_png(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                     lon: float | None = LON, lat: float | None = LAT,
                     uc: GetReturnField = Depends(return_field_uc)) -> Response:
    f = uc.execute(leg, scenario, _staging(lon, lat))
    return Response(field_png(f.values, f.max_value), media_type="image/png")


@router.get("/return-field/safe-mask.png", response_class=Response)
def safe_mask_png(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                  lon: float | None = LON, lat: float | None = LAT,
                  uc: GetReturnField = Depends(return_field_uc)) -> Response:
    f = uc.execute(leg, scenario, _staging(lon, lat))
    return Response(mask_png(f.safe_mask), media_type="image/png")


@router.get("/scenarios", response_model=list[ScenarioOut])
def scenarios(uc: ListScenarios = Depends(list_scenarios_uc)) -> list[ScenarioOut]:
    return [ScenarioOut.from_domain(s) for s in uc.execute()]
