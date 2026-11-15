"""Inyección de dependencias de FastAPI hacia los casos de uso."""
from __future__ import annotations

from collections.abc import Callable

from senda.application.assistant.tools import MissionContext, MissionTools
from senda.application.ports.outbound import AssistantModel
from senda.application.use_cases.assistant import ChatWithAssistant
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment
from senda.application.use_cases.plan_outing import PlanOuting
from senda.application.use_cases.plan_routes import PlanEva, PlanPath, PlanTraverse
from senda.application.use_cases.quantum import OptimizeTargetsQuantum
from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.application.use_cases.terrain import GetTerrain
from senda.config import Settings
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


def optimize_quantum_uc() -> OptimizeTargetsQuantum:
    c = get_container()
    return OptimizeTargetsQuantum(c.target_repo, c.quantum)


def assistant_settings() -> Settings:
    return get_container().settings


def assistant_model() -> AssistantModel | None:
    return get_container().assistant_model


def chat_uc() -> Callable[[MissionContext], ChatWithAssistant] | None:
    """Fábrica por petición: el registro de planes es propio de cada conversación y
    las herramientas parten de lo que el usuario tiene en pantalla."""
    c = get_container()
    model = c.assistant_model
    if model is None:
        return None

    def build(context: MissionContext) -> ChatWithAssistant:
        assess = AssessReadiness(c.environment_repo)
        targets = ListTargets(c.target_repo)
        outing = PlanOuting(assess, targets, PlanTraverse(c.target_repo, c.terrain),
                            PlanEva(c.target_repo, c.terrain))
        tools = MissionTools(assess, GetEnvironment(c.environment_repo), targets, outing,
                             c.knowledge, context)
        return ChatWithAssistant(model, tools)

    return build
