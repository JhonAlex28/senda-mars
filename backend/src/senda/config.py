"""Configuración leída de variables de entorno."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    cors_origins: list[str]

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.getenv("SENDA_DATA_DIR", str(_BACKEND_ROOT / "data")))
        if not data_dir.is_absolute():
            data_dir = (_BACKEND_ROOT / data_dir).resolve()
        origins = os.getenv("SENDA_CORS_ORIGINS", "http://localhost:5173")
        return cls(
            data_dir=data_dir,
            cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        )
