"""Campo de retorno (metadatos + PNG) y catálogo de escenarios."""
from fastapi import APIRouter, Depends, Query, Response

from senda.adapters.inbound.http.dependencies import list_scenarios_uc, return_field_uc
from senda.adapters.inbound.http.png import field_png, mask_png
from senda.adapters.inbound.http.schemas import ReturnFieldResponse, ScenarioOut
from senda.application.use_cases.return_field import GetReturnField, ListScenarios

router = APIRouter(tags=["safety"])
PREFIX = "/api/v1"


@router.get("/return-field", response_model=ReturnFieldResponse)
def return_field(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                 uc: GetReturnField = Depends(return_field_uc)) -> ReturnFieldResponse:
    f = uc.execute(leg, scenario)
    q = f"leg={leg}&scenario={f.scenario}"
    b = f.bbox
    return ReturnFieldResponse(leg=leg, scenario=f.scenario,
                               png_url=f"{PREFIX}/return-field/image.png?{q}",
                               safe_mask_png_url=f"{PREFIX}/return-field/safe-mask.png?{q}",
                               bbox_lonlat=(b.min_lon, b.min_lat, b.max_lon, b.max_lat),
                               unit=f.unit, max_value=round(f.max_value, 3), source_id=f.source_id)


@router.get("/return-field/image.png", response_class=Response)
def return_field_png(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                     uc: GetReturnField = Depends(return_field_uc)) -> Response:
    f = uc.execute(leg, scenario)
    return Response(field_png(f.values, f.max_value), media_type="image/png")


@router.get("/return-field/safe-mask.png", response_class=Response)
def safe_mask_png(leg: str = Query("eva", pattern="^(eva|rover)$"), scenario: str = "none",
                  uc: GetReturnField = Depends(return_field_uc)) -> Response:
    f = uc.execute(leg, scenario)
    return Response(mask_png(f.safe_mask), media_type="image/png")


@router.get("/scenarios", response_model=list[ScenarioOut])
def scenarios(uc: ListScenarios = Depends(list_scenarios_uc)) -> list[ScenarioOut]:
    return [ScenarioOut.from_domain(s) for s in uc.execute()]
