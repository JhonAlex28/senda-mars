"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.knowledge.markdown_kb import MarkdownKnowledgeBase
from senda.adapters.outbound.llm.ollama_model import OllamaAssistantModel
from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.adapters.outbound.persistence.sql_store import CrewStore, ProcedureStore, SqlMissionStore
from senda.adapters.outbound.quantum.qiskit_qaoa import QiskitQaoaOptimizer
from senda.adapters.outbound.terrain.npy_dem import NpyDemTerrainProvider, dem_available
from senda.adapters.outbound.terrain.synthetic import SyntheticTerrainProvider
from senda.application.ports.outbound import (AssistantModel, CrewRepository,
                                              EnvironmentRepository, KnowledgeBase, PlanRepository,
                                              ProcedureRepository, QuantumOptimizer,
                                              TargetRepository, TerrainProvider)
from senda.config import Settings
from senda.domain.models.geo import BoundingBox


@dataclass(frozen=True)
class Container:
    settings: Settings
    target_repo: TargetRepository
    environment_repo: EnvironmentRepository
    terrain: TerrainProvider
    knowledge: KnowledgeBase
    quantum: QuantumOptimizer
    plans: PlanRepository
    crew: CrewRepository
    procedures: ProcedureRepository
    assistant_model: AssistantModel | None = None   # None = asistente desactivado


def _terrain(s: Settings, site: BoundingBox) -> TerrainProvider:
    """Terreno real (DEM del USGS) si está disponible; el sintético queda como demo/respaldo."""
    terrain_dir = s.data_dir / "terrain"
    if s.terrain != "synthetic" and dem_available(terrain_dir):
        return NpyDemTerrainProvider(site, terrain_dir)
    return SyntheticTerrainProvider(site)


def _assistant_model(s: Settings) -> AssistantModel | None:
    if not s.assistant_enabled:
        return None
    return OllamaAssistantModel(s.llm_model, s.ollama_url, s.llm_context_tokens,
                                s.ollama_token)


@lru_cache
def get_container() -> Container:
    s = Settings.from_env()
    environment = JsonEnvironmentRepository(s.data_dir / "env.json")
    store = SqlMissionStore(s.database_url)   # crea las tablas si no existen
    return Container(
        settings=s,
        target_repo=JsonTargetRepository(s.data_dir / "targets_v0.geojson"),
        environment_repo=environment,
        terrain=_terrain(s, environment.site_bounds()),
        knowledge=MarkdownKnowledgeBase(s.data_dir / "knowledge"),
        quantum=QiskitQaoaOptimizer(s.ibm_quantum_token, s.ibm_quantum_channel,
                                    s.ibm_quantum_instance),
        plans=store,
        crew=CrewStore(store),
        procedures=ProcedureStore(store),
        assistant_model=_assistant_model(s),
    )
