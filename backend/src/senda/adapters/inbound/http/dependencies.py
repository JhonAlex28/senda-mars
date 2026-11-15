"""Inyección de dependencias de FastAPI hacia los casos de uso."""
from __future__ import annotations

from senda.application.planner_context import PlannerContext
from senda.application.use_cases.environment import GetEnvironment
from senda.application.use_cases.plan_mission import PlanMission
from senda.application.use_cases.plan_routes import PlanRoutes
from senda.application.use_cases.plan_traverse import PlanTraverse
from senda.application.use_cases.return_field import GetReturnField, ListScenarios
from senda.application.use_cases.simulate_eva import SimulateEva
from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.container import get_container


def list_targets_uc() -> ListTargets:
    return ListTargets(get_container().target_repo)


def get_target_uc() -> GetTarget:
    return GetTarget(get_container().target_repo)


def get_environment_uc() -> GetEnvironment:
    return GetEnvironment(get_container().environment_repo)


def planner_ctx() -> PlannerContext:
    return get_container().planner


def plan_routes_uc() -> PlanRoutes:
    return PlanRoutes(planner_ctx())


def plan_traverse_uc() -> PlanTraverse:
    return PlanTraverse(planner_ctx())


def plan_mission_uc() -> PlanMission:
    return PlanMission(planner_ctx())


def simulate_uc() -> SimulateEva:
    return SimulateEva(planner_ctx())


def return_field_uc() -> GetReturnField:
    return GetReturnField(planner_ctx())


def list_scenarios_uc() -> ListScenarios:
    return ListScenarios()
