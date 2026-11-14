"""Inyección de dependencias de FastAPI hacia los casos de uso."""
from __future__ import annotations

from senda.application.use_cases.environment import GetEnvironment
from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.container import get_container


def list_targets_uc() -> ListTargets:
    return ListTargets(get_container().target_repo)


def get_target_uc() -> GetTarget:
    return GetTarget(get_container().target_repo)


def get_environment_uc() -> GetEnvironment:
    return GetEnvironment(get_container().environment_repo)
