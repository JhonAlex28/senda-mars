"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.adapters.outbound.terrain.synthetic import SyntheticTerrainProvider
from senda.application.ports.outbound import EnvironmentRepository, TargetRepository, TerrainProvider
from senda.config import Settings


@dataclass(frozen=True)
class Container:
    settings: Settings
    target_repo: TargetRepository
    environment_repo: EnvironmentRepository
    terrain: TerrainProvider


@lru_cache
def get_container() -> Container:
    s = Settings.from_env()
    environment = JsonEnvironmentRepository(s.data_dir / "env.json")
    return Container(
        settings=s,
        target_repo=JsonTargetRepository(s.data_dir / "targets_v0.geojson"),
        environment_repo=environment,
        # Cambiar por un DEM real (geotiff_dem.py) solo toca esta línea
        terrain=SyntheticTerrainProvider(environment.site_bounds()),
    )
