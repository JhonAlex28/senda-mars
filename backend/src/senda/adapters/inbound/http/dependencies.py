"""Inyección de dependencias de FastAPI hacia los casos de uso."""
from __future__ import annotations

from senda.application.use_cases.environment import AssessReadiness, GetEnvironment
from senda.application.use_cases.plan_routes import PlanEva, PlanPath, PlanTraverse
from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.application.use_cases.terrain import GetTerrain
from senda.container import get_container


def list_targets_uc() -> ListTargets:
    return ListTargets(get_container().target_repo)


def get_target_uc() -> GetTarget:
    return GetTarget(get_container().target_repo)


def get_environment_uc() -> GetEnvironment:
    return GetEnvironment(get_container().environment_repo)


def assess_readiness_uc() -> AssessReadiness:
    return AssessReadiness(get_container().environment_repo)


def get_terrain_uc() -> GetTerrain:
    return GetTerrain(get_container().terrain)


def plan_traverse_uc() -> PlanTraverse:
    c = get_container()
    return PlanTraverse(c.target_repo, c.terrain)


def plan_eva_uc() -> PlanEva:
    c = get_container()
    return PlanEva(c.target_repo, c.terrain)


def plan_path_uc() -> PlanPath:
    c = get_container()
    return PlanPath(c.target_repo, c.terrain)
