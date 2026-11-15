"""Configuración leída de variables de entorno.

En desarrollo también se lee `backend/.env` (ignorado por git), para no depender de la
terminal desde la que se arranca. Las variables ya definidas en el entorno tienen prioridad
(así funciona igual en Render, donde se configuran en el panel)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    cors_origins: list[str]
    # "dem" = terreno real del USGS (data/terrain); "synthetic" = terreno por fórmula (demo)
    terrain: str = "dem"
    # Asistente de IA local (Ollama). Desactivado por defecto: en Render no hay modelo
    assistant_enabled: bool = False
    llm_model: str = "qwen3:1.7b"
    ollama_url: str = "http://localhost:11434"
    llm_context_tokens: int = 8192
    ollama_token: str = ""
    # IBM Quantum (opcional): solo en el servidor, nunca en el frontend ni en git
    ibm_quantum_token: str = ""
    ibm_quantum_channel: str = "ibm_quantum_platform"
    ibm_quantum_instance: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        _load_dotenv(_BACKEND_ROOT / ".env")
        data_dir = Path(os.getenv("SENDA_DATA_DIR", str(_BACKEND_ROOT / "data")))
        if not data_dir.is_absolute():
            data_dir = (_BACKEND_ROOT / data_dir).resolve()
        origins = os.getenv("SENDA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return cls(
            data_dir=data_dir,
            cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
            terrain=os.getenv("SENDA_TERRAIN", "dem").strip().lower(),
            assistant_enabled=_flag(os.getenv("SENDA_ASSISTANT_ENABLED", "false")),
            llm_model=os.getenv("SENDA_LLM_MODEL", "qwen3:1.7b"),
            ollama_url=os.getenv("SENDA_OLLAMA_URL", "http://localhost:11434"),
            llm_context_tokens=int(os.getenv("SENDA_LLM_CONTEXT_TOKENS", "8192")),
            ollama_token=os.getenv("SENDA_OLLAMA_TOKEN", ""),
            ibm_quantum_token=os.getenv("IBM_QUANTUM_TOKEN", ""),
            ibm_quantum_channel=os.getenv("IBM_QUANTUM_CHANNEL", "ibm_quantum_platform"),
            ibm_quantum_instance=os.getenv("IBM_QUANTUM_INSTANCE", ""),
        )


def _flag(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


def _load_dotenv(path: Path) -> None:
    """Lector mínimo de KEY=VALUE (sin dependencias). No pisa variables ya definidas."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
