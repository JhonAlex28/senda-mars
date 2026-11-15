"""POST /api/v1/simulate — reproducción de la EVA con escenarios y alertas."""
from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import planner_ctx, simulate_uc
from senda.adapters.inbound.http.presenters import assumptions
from senda.adapters.inbound.http.schemas import (DiversionOut, RouteOut, SimRowOut, SimulateRequest,
                                                 SimulateResponse, _lonlat)
from senda.application.planner_context import PlannerContext
from senda.application.use_cases.simulate_eva import SimulateEva, StopInput

router = APIRouter(prefix="/simulate", tags=["safety"])


@router.post("", response_model=SimulateResponse, response_model_by_alias=True)
def simulate(req: SimulateRequest, uc: SimulateEva = Depends(simulate_uc),
             ctx: PlannerContext = Depends(planner_ctx)) -> SimulateResponse:
    out = uc.execute(req.route.profile, [tuple(c) for c in req.route.cells],
                     [StopInput(s.target_id, s.path_index) for s in req.route.stops],
                     req.scenario, req.scenario_at_index)
    spec = ctx.local().spec
    r = out.result
    diversion = None
    if r.diverted_at_index is not None:
        diversion = DiversionOut(at_index=r.diverted_at_index, to=r.diverted_to or "",
                                 path=_lonlat(spec, r.diverted_path))
    return SimulateResponse(
        scenario=req.scenario,
        timeline=[SimRowOut.from_domain(row, spec) for row in r.rows],
        replanned_route=RouteOut.from_domain(out.replanned, spec) if out.replanned else None,
        diversion=diversion, assumptions=assumptions(ctx, ctx.local()))
