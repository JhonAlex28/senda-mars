"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.application.ports.outbound import EnvironmentRepository, TargetRepository
from senda.config import Settings


@dataclass(frozen=True)
class Container:
    settings: Settings
    target_repo: TargetRepository
    environment_repo: EnvironmentRepository


@lru_cache
def get_container() -> Container:
    s = Settings.from_env()
    return Container(
        settings=s,
        target_repo=JsonTargetRepository(s.data_dir / "targets_v0.geojson"),
        environment_repo=JsonEnvironmentRepository(s.data_dir / "env.json"),
    )
