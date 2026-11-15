"""Casos de uso del registro de la misión.

  MissionCalendar  planes guardados por sol: "hoy" es el sol actual del entorno, "mañana" el siguiente
  CrewRoster       la tripulación (quién planifica); si no hay, se crea la de por defecto
  ProcedureLog     procedimientos científicos completados en la simulación
"""
from __future__ import annotations

import uuid
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, Callable

from senda.application.ports.outbound import (CrewRepository, EnvironmentRepository,
                                              PlanRepository, ProcedureRepository)
from senda.domain.errors import InvalidMissionLog, PlanNotFound
from senda.domain.models.mission_log import (DEFAULT_CREW, PLAN_STATUSES, Crew, ProcedureRecord,
                                             SavedPlan)

Day = str | int   # "today" | "tomorrow" | número de sol
MAX_TITLE = 120
MAX_CREW = 8


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MissionCalendar:
    def __init__(self, plans: PlanRepository, environment: EnvironmentRepository,
                 clock: Callable[[], datetime] = _now) -> None:
        self._plans = plans
        self._environment = environment
        self._clock = clock

    def today(self) -> int:
        return self._environment.get_current().sol

    def resolve(self, day: Day | None) -> int:
        """"today" → sol actual, "tomorrow" → sol + 1, un número → ese sol."""
        today = self.today()
        if day is None or day == "today":
            return today
        if day == "tomorrow":
            return today + 1
        try:
            sol = int(day)
        except (TypeError, ValueError) as e:
            raise InvalidMissionLog("day must be 'today', 'tomorrow' or a sol number") from e
        if sol < 0:
            raise InvalidMissionLog("sol must be positive")
        return sol

    def for_day(self, day: Day | None = None, everything: bool = False) -> list[SavedPlan]:
        return self._plans.find(None if everything else self.resolve(day))

    def get(self, plan_id: str) -> SavedPlan:
        plan = self._plans.get(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)
        return plan

    def save(self, *, title: str, day: Day | None, site_id: str, created_by: str | None,
             summary: dict[str, Any], payload: dict[str, Any], plan_id: str | None = None,
             status: str = "planned") -> SavedPlan:
        title = title.strip()
        if not title or len(title) > MAX_TITLE:
            raise InvalidMissionLog(f"title must have 1 to {MAX_TITLE} characters")
        if status not in PLAN_STATUSES:
            raise InvalidMissionLog(f"status must be one of {PLAN_STATUSES}")
        now = self._clock()
        previous = self._plans.get(plan_id) if plan_id else None
        if plan_id and previous is None:
            raise PlanNotFound(plan_id)
        plan = SavedPlan(
            id=plan_id or str(uuid.uuid4()), title=title, sol=self.resolve(day), site_id=site_id,
            status=status, created_by=created_by, summary=summary, payload=payload,
            created_at=previous.created_at if previous else now, updated_at=now,
        )
        return self._plans.save(plan)

    def set_status(self, plan_id: str, status: str) -> SavedPlan:
        if status not in PLAN_STATUSES:
            raise InvalidMissionLog(f"status must be one of {PLAN_STATUSES}")
        plan = self.get(plan_id)
        return self._plans.save(replace(plan, status=status, updated_at=self._clock()))

    def delete(self, plan_id: str) -> None:
        if not self._plans.delete(plan_id):
            raise PlanNotFound(plan_id)


class CrewRoster:
    def __init__(self, repo: CrewRepository) -> None:
        self._repo = repo

    def get(self) -> Crew:
        crew = self._repo.get()
        return crew if crew is not None else self._repo.save(DEFAULT_CREW)

    def save(self, crew: Crew) -> Crew:
        ids = [m.id for m in crew.members]
        if not crew.team_name.strip():
            raise InvalidMissionLog("team name is required")
        if not 1 <= len(ids) <= MAX_CREW or len(set(ids)) != len(ids):
            raise InvalidMissionLog(f"crew needs 1 to {MAX_CREW} members with unique ids")
        if any(not m.name.strip() for m in crew.members):
            raise InvalidMissionLog("every crew member needs a name")
        return self._repo.save(crew)


class ProcedureLog:
    def __init__(self, repo: ProcedureRepository, clock: Callable[[], datetime] = _now) -> None:
        self._repo = repo
        self._clock = clock

    def history(self, site_id: str | None = None) -> list[ProcedureRecord]:
        return self._repo.find(site_id)

    def record(self, site_id: str, target_id: str, crew_member: str | None = None,
               plan_id: str | None = None) -> ProcedureRecord:
        if not site_id or not target_id:
            raise InvalidMissionLog("site_id and target_id are required")
        return self._repo.add(ProcedureRecord(str(uuid.uuid4()), site_id, target_id, self._clock(),
                                              crew_member, plan_id))
