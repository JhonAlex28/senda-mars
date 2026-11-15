"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.knowledge.markdown_kb import MarkdownKnowledgeBase
from senda.adapters.outbound.llm.ollama_model import OllamaAssistantModel
from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_params import JsonMissionParamsRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.adapters.outbound.quantum.qiskit_qaoa import QiskitQaoaOptimizer
from senda.adapters.outbound.terrain.npy_terrain import CompositeTerrainProvider, NpyTerrainProvider
from senda.adapters.outbound.terrain.synthetic import SyntheticTerrainProvider
from senda.application.planner_context import PlannerContext
from senda.application.ports.outbound import (AssistantModel, EnvironmentRepository, KnowledgeBase,
                                              MissionParamsRepository, QuantumOptimizer,
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
    knowledge: KnowledgeBase
    quantum: QuantumOptimizer
    assistant_model: AssistantModel | None = None   # None = asistente desactivado


def _assistant_model(s: Settings) -> AssistantModel | None:
    if not s.assistant_enabled:
        return None
    return OllamaAssistantModel(s.llm_model, s.ollama_url, s.llm_context_tokens,
                                s.ollama_token)


def build_container(s: Settings) -> Container:
    targets = JsonTargetRepository(s.data_dir / "targets_v1.geojson")
    params = JsonMissionParamsRepository(s.data_dir / "env.json", s.data_dir / "mission_params.json")
    p = params.get()
    human = (p.eva.slope_caution_deg, p.eva.slope_nogo_deg)
    rover = (p.rover.slope_caution_deg, p.rover.slope_nogo_deg)
    anchors = [(t.location.lon, t.location.lat, t.elevation_m) for t in targets.list_all()]
    synthetic = SyntheticTerrainProvider(anchors, human_slopes=human, rover_slopes=rover,
                                         base_lonlat=p.base_lonlat)
    # DEM real del USGS (Mec. A) si existe; SENDA_TERRAIN=synthetic fuerza el sintético (demo)
    terrain_dir = s.data_dir / "terrain" if s.terrain != "synthetic" else None
    terrain = CompositeTerrainProvider(NpyTerrainProvider(s.data_dir / "terrain", human, rover), synthetic,
                                       terrain_dir, s.max_planning_cells,
                                       slopes={Scale.LOCAL: human, Scale.REGIONAL: rover})
    return Container(
        settings=s,
        target_repo=targets,
        environment_repo=JsonEnvironmentRepository(s.data_dir / "env.json"),
        params_repo=params,
        terrain=terrain,
        planner=PlannerContext(terrain, targets, params),
        knowledge=MarkdownKnowledgeBase(s.data_dir / "knowledge"),
        quantum=QiskitQaoaOptimizer(s.ibm_quantum_token, s.ibm_quantum_channel,
                                    s.ibm_quantum_instance),
        assistant_model=_assistant_model(s),
    )


@lru_cache
def get_container() -> Container:
    return build_container(Settings.from_env())
