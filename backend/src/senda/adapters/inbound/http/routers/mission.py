"""POST /api/v1/mission/plan — misión completa: rover + EVA + timeline por sol."""
from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import planner_ctx, plan_mission_uc
from senda.adapters.inbound.http.presenters import assumptions, grid_info
from senda.adapters.inbound.http.schemas import MissionRequest, MissionResponse
from senda.application.planner_context import PlannerContext
from senda.application.use_cases.plan_mission import PlanMission
from senda.domain.services.mission_timeline import ltst_to_hours

router = APIRouter(prefix="/mission", tags=["planner"])


@router.post("/plan", response_model=MissionResponse, response_model_by_alias=True)
def plan_mission(req: MissionRequest, uc: PlanMission = Depends(plan_mission_uc),
                 ctx: PlannerContext = Depends(planner_ctx)) -> MissionResponse:
    m = uc.execute(req.target_ids, req.profiles, req.staging_target_id,
                   tuple(req.base) if req.base else None, req.departure.sol,
                   ltst_to_hours(req.departure.ltst), req.timeline_profile, req.scenario)
    local, regional = ctx.local(), ctx.regional()
    return MissionResponse.from_domain(m, grid_info(local), grid_info(regional), local.spec, regional.spec,
                                       assumptions(ctx, local, regional))
