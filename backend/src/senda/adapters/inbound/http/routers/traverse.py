"""POST /api/v1/traverse — tramo en rover presurizado (grilla regional)."""
from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import planner_ctx, plan_traverse_uc
from senda.adapters.inbound.http.presenters import assumptions, grid_info
from senda.adapters.inbound.http.schemas import TraverseOut, TraverseRequest, TraverseResponse
from senda.application.planner_context import PlannerContext
from senda.application.use_cases.plan_traverse import PlanTraverse

router = APIRouter(prefix="/traverse", tags=["planner"])


@router.post("", response_model=TraverseResponse)
def plan_traverse(req: TraverseRequest, uc: PlanTraverse = Depends(plan_traverse_uc),
                  ctx: PlannerContext = Depends(planner_ctx)) -> TraverseResponse:
    origin = req.from_ or ctx.params.base_lonlat
    if req.to is None:
        st = ctx.default_staging()
        dest = (st.location.lon, st.location.lat)
    elif isinstance(req.to, str):
        t = ctx.target(req.to)
        dest = (t.location.lon, t.location.lat)
    else:
        dest = req.to
    plan = uc.execute(tuple(origin), tuple(dest))
    grid = ctx.regional()
    out = TraverseOut.from_domain(plan, grid.spec)
    return TraverseResponse(**out.model_dump(), grid=grid_info(grid), assumptions=assumptions(ctx, grid))
