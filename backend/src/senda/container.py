"""Composition root: único lugar donde se eligen los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from senda.adapters.outbound.knowledge.markdown_kb import MarkdownKnowledgeBase
from senda.adapters.outbound.llm.ollama_model import OllamaAssistantModel
from senda.adapters.outbound.persistence.json_environment import JsonEnvironmentRepository
from senda.adapters.outbound.persistence.json_targets import JsonTargetRepository
from senda.adapters.outbound.terrain.synthetic import SyntheticTerrainProvider
from senda.application.ports.outbound import (AssistantModel, EnvironmentRepository,
                                              KnowledgeBase, TargetRepository, TerrainProvider)
from senda.config import Settings


@dataclass(frozen=True)
class Container:
    settings: Settings
    target_repo: TargetRepository
    environment_repo: EnvironmentRepository
    terrain: TerrainProvider
    knowledge: KnowledgeBase
    assistant_model: AssistantModel | None = None   # None = asistente desactivado


def _assistant_model(s: Settings) -> AssistantModel | None:
    if not s.assistant_enabled:
        return None
    return OllamaAssistantModel(s.llm_model, s.ollama_url, s.llm_context_tokens,
                                s.ollama_token)


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
        knowledge=MarkdownKnowledgeBase(s.data_dir / "knowledge"),
        assistant_model=_assistant_model(s),
    )
