from fastapi import APIRouter, Depends, HTTPException

from senda.adapters.inbound.http.dependencies import plan_eva_uc, plan_path_uc, plan_traverse_uc
from senda.adapters.inbound.http.schemas import EvaIn, PathIn, RouteOut, TraverseIn, TraverseOut
from senda.application.use_cases.plan_routes import PlanEva, PlanPath, PlanTraverse
from senda.domain.errors import InvalidRequest, NoRouteFound, OutsideSite, TargetNotFound

router = APIRouter(prefix="/routes", tags=["routes"])


def _http_error(e: Exception) -> HTTPException:
    status = 404 if isinstance(e, TargetNotFound) else 422   # InvalidRequest/OutsideSite/NoRouteFound
    return HTTPException(status_code=status, detail=str(e))


@router.post("/traverse", response_model=TraverseOut)
def plan_traverse(body: TraverseIn, uc: PlanTraverse = Depends(plan_traverse_uc)) -> TraverseOut:
    """Recorrido del rover: base → estacionamientos → base, en tres alternativas."""
    try:
        plan = uc.execute(body.base.to_domain(), body.target_ids, body.domain_hazards(),
                          body.conditions.to_domain())
    except (TargetNotFound, NoRouteFound, OutsideSite, InvalidRequest) as e:
        raise _http_error(e) from e
    return TraverseOut.from_domain(plan)


@router.post("/eva", response_model=list[RouteOut])
def plan_eva(body: EvaIn, uc: PlanEva = Depends(plan_eva_uc)) -> list[RouteOut]:
    """Caminata desde el rover estacionado hasta los objetivos cercanos y de vuelta."""
    try:
        routes = uc.execute(body.rover.to_domain(), body.target_ids, body.domain_hazards(),
                            body.conditions.to_domain())
    except (TargetNotFound, NoRouteFound, OutsideSite, InvalidRequest) as e:
        raise _http_error(e) from e
    return [RouteOut.from_domain(r) for r in routes]


@router.post("/path", response_model=list[RouteOut])
def plan_path(body: PathIn, uc: PlanPath = Depends(plan_path_uc)) -> list[RouteOut]:
    """Ruta por waypoints arbitrarios: replanificación por contingencia y retornos."""
    try:
        routes = uc.execute(body.mode, [w.to_waypoint() for w in body.waypoints],
                            body.domain_hazards(), body.conditions.to_domain(), body.profiles)
    except (TargetNotFound, NoRouteFound, OutsideSite, InvalidRequest) as e:
        raise _http_error(e) from e
    return [RouteOut.from_domain(r) for r in routes]
