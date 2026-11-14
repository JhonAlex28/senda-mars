"""Adaptador de salida: lee el modelo ambiental desde env.json."""
from __future__ import annotations

import json
from pathlib import Path

from senda.domain.models.environment import EnvironmentSnapshot


class JsonEnvironmentRepository:
    def __init__(self, path: Path) -> None:
        self._path = path

    def get_current(self) -> EnvironmentSnapshot:
        d = json.loads(self._path.read_text(encoding="utf-8"))
        t, atm, temp = d.get("time", {}), d.get("atmosphere", {}), d.get("temperature", {})
        return EnvironmentSnapshot(
            sol=int(t.get("sol", 0)),
            ls_deg=float(t.get("ls_deg", 0.0)),
            local_solar_time=str(t.get("local_solar_time", "")),
            pressure_pa=float(atm.get("pressure_Pa", 0.0)),
            temp_min_c=float(temp.get("min_C", 0.0)),
            temp_max_c=float(temp.get("max_C", 0.0)),
            details={k: v for k, v in d.items() if k not in ("time", "atmosphere", "temperature")},
        )
