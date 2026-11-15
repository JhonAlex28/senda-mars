"""Registro de la misión: planes guardados por sol, tripulación y procedimientos completados."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from senda.adapters.inbound.http.dependencies import (crew_roster_uc, mission_calendar_uc,
                                                      procedure_log_uc)
from senda.adapters.inbound.http.schemas import (CrewDto, PlanIn, PlanListOut, PlanOut,
                                                 PlanStatusIn, ProcedureIn, ProcedureOut)
from senda.application.use_cases.mission_log import CrewRoster, MissionCalendar, ProcedureLog
from senda.domain.errors import DomainError, PlanNotFound

router = APIRouter(tags=["mission log"])


def _http(e: DomainError) -> HTTPException:
    return HTTPException(status_code=404 if isinstance(e, PlanNotFound) else 422, detail=str(e))


@router.get("/plans", response_model=PlanListOut)
def list_plans(day: str | None = Query(None, description="today, tomorrow o un número de sol"),
               all: bool = Query(False, description="todos los soles"),
               uc: MissionCalendar = Depends(mission_calendar_uc)) -> PlanListOut:
    """Planes de un sol (por defecto hoy) o de todos; sin el contenido pesado (payload)."""
    try:
        plans = uc.for_day(day, everything=all)
    except DomainError as e:
        raise _http(e) from e
    return PlanListOut(today_sol=uc.today(), plans=[PlanOut.from_domain(p) for p in plans])


@router.get("/plans/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: str, uc: MissionCalendar = Depends(mission_calendar_uc)) -> PlanOut:
    try:
        return PlanOut.from_domain(uc.get(plan_id), with_payload=True)
    except DomainError as e:
        raise _http(e) from e


@router.post("/plans", response_model=PlanOut, status_code=201)
def create_plan(body: PlanIn, uc: MissionCalendar = Depends(mission_calendar_uc)) -> PlanOut:
    return _save(body, None, uc)


@router.put("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: str, body: PlanIn,
                uc: MissionCalendar = Depends(mission_calendar_uc)) -> PlanOut:
    return _save(body, plan_id, uc)


def _save(body: PlanIn, plan_id: str | None, uc: MissionCalendar) -> PlanOut:
    try:
        plan = uc.save(title=body.title, day=body.day, site_id=body.site_id,
                       created_by=body.created_by, summary=body.summary, payload=body.payload,
                       plan_id=plan_id, status=body.status)
    except DomainError as e:
        raise _http(e) from e
    return PlanOut.from_domain(plan, with_payload=True)


@router.patch("/plans/{plan_id}/status", response_model=PlanOut)
def set_plan_status(plan_id: str, body: PlanStatusIn,
                    uc: MissionCalendar = Depends(mission_calendar_uc)) -> PlanOut:
    try:
        return PlanOut.from_domain(uc.set_status(plan_id, body.status))
    except DomainError as e:
        raise _http(e) from e


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: str, uc: MissionCalendar = Depends(mission_calendar_uc)) -> Response:
    try:
        uc.delete(plan_id)
    except DomainError as e:
        raise _http(e) from e
    return Response(status_code=204)


@router.get("/crew", response_model=CrewDto)
def get_crew(uc: CrewRoster = Depends(crew_roster_uc)) -> CrewDto:
    return CrewDto.from_domain(uc.get())


@router.put("/crew", response_model=CrewDto)
def save_crew(body: CrewDto, uc: CrewRoster = Depends(crew_roster_uc)) -> CrewDto:
    try:
        return CrewDto.from_domain(uc.save(body.to_domain()))
    except DomainError as e:
        raise _http(e) from e


@router.get("/procedures", response_model=list[ProcedureOut])
def list_procedures(site_id: str | None = None,
                    uc: ProcedureLog = Depends(procedure_log_uc)) -> list[ProcedureOut]:
    return [ProcedureOut.from_domain(r) for r in uc.history(site_id)]


@router.post("/procedures", response_model=ProcedureOut, status_code=201)
def record_procedure(body: ProcedureIn,
                     uc: ProcedureLog = Depends(procedure_log_uc)) -> ProcedureOut:
    try:
        return ProcedureOut.from_domain(uc.record(body.site_id, body.target_id, body.crew_member,
                                                  body.plan_id))
    except DomainError as e:
        raise _http(e) from e
