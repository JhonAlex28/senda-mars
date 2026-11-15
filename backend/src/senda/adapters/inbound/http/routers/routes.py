"""POST /api/v1/routes — rutas EVA (3 perfiles) desde/hacia el staging del SEV."""
from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import planner_ctx, plan_routes_uc
from senda.adapters.inbound.http.presenters import assumptions, grid_info
from senda.adapters.inbound.http.schemas import RouteOut, RoutesRequest, RoutesResponse
from senda.application.planner_context import PlannerContext
from senda.application.use_cases.plan_routes import PlanRoutes

router = APIRouter(prefix="/routes", tags=["planner"])


@router.post("", response_model=RoutesResponse, response_model_by_alias=True)
def plan_routes(req: RoutesRequest, uc: PlanRoutes = Depends(plan_routes_uc),
                ctx: PlannerContext = Depends(planner_ctx)) -> RoutesResponse:
    res = uc.execute(req.target_ids, req.profiles, req.start_target_id, req.end_target_id, req.scenario)
    grid = ctx.local()
    return RoutesResponse(staging_id=res.staging_id,
                          routes=[RouteOut.from_domain(r, grid.spec) for r in res.routes],
                          grid=grid_info(grid), assumptions=assumptions(ctx, grid))
