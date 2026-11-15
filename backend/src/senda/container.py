"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_params import JsonMissionParamsRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.adapters.outbound.terrain.npy_terrain import CompositeTerrainProvider, NpyTerrainProvider
from senda.adapters.outbound.terrain.synthetic import SyntheticTerrainProvider
from senda.application.planner_context import PlannerContext
from senda.application.ports.outbound import (EnvironmentRepository, MissionParamsRepository,
                                              TargetRepository, TerrainProvider)
from senda.config import Settings
from senda.domain.models.terrain import Scale


@dataclass(frozen=True)
class Container:
    settings: Settings
    target_repo: TargetRepository
    environment_repo: EnvironmentRepository
    params_repo: MissionParamsRepository
    terrain: TerrainProvider
    planner: PlannerContext


def build_container(s: Settings) -> Container:
    targets = JsonTargetRepository(s.data_dir / "targets_v0.geojson")
    params = JsonMissionParamsRepository(s.data_dir / "env.json", s.data_dir / "mission_params.json")
    p = params.get()
    human = (p.eva.slope_caution_deg, p.eva.slope_nogo_deg)
    rover = (p.rover.slope_caution_deg, p.rover.slope_nogo_deg)
    anchors = [(t.location.lon, t.location.lat, t.elevation_m) for t in targets.list_all()]
    synthetic = SyntheticTerrainProvider(anchors, human_slopes=human, rover_slopes=rover,
                                         base_lonlat=p.base_lonlat)
    terrain_dir = s.data_dir / "terrain"
    terrain = CompositeTerrainProvider(NpyTerrainProvider(terrain_dir, human, rover), synthetic, terrain_dir,
                                       s.max_planning_cells,
                                       slopes={Scale.LOCAL: human, Scale.REGIONAL: rover})
    return Container(
        settings=s,
        target_repo=targets,
        environment_repo=JsonEnvironmentRepository(s.data_dir / "env.json"),
        params_repo=params,
        terrain=terrain,
        planner=PlannerContext(terrain, targets, params),
    )


@lru_cache
def get_container() -> Container:
    return build_container(Settings.from_env())
