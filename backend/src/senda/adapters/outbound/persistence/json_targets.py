"""Adaptador de salida: lee objetivos desde un GeoJSON en disco."""
from __future__ import annotations

import json
from pathlib import Path

from senda.domain.models.geo import GeoPoint
from senda.domain.models.target import Rubric, ScienceTarget, ScienceTask


class JsonTargetRepository:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._cache: dict[str, ScienceTarget] | None = None

    def _load(self) -> dict[str, ScienceTarget]:
        if self._cache is None:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            cache: dict[str, ScienceTarget] = {}
            for feat in data["features"]:
                p = feat["properties"]
                lon, lat = feat["geometry"]["coordinates"][:2]
                r = p.get("rubric", {})
                s = p.get("eva_sampling")
                task = ScienceTask(
                    tool=s.get("tool", ""),
                    duration_min=float(s.get("duration_min", 0.0)),
                    protocol=s.get("protocol", ""),
                ) if s else None
                cache[p["id"]] = ScienceTarget(
                    id=p["id"],
                    name=p["name"],
                    location=GeoPoint(lon=lon, lat=lat),
                    elevation_m=float(p.get("elev_geoid_m", 0.0)),
                    rubric=Rubric(
                        novelty=int(r.get("novelty", 0)),
                        habitability=int(r.get("habitability", 0)),
                        human_only=int(r.get("human_only", 0)),
                    ),
                    description=p.get("desc_en", ""),
                    category=p.get("type_en", ""),
                    is_base=bool(p.get("is_base", False)),
                    task=task,
                )
            self._cache = cache
        return self._cache

    def list_all(self) -> list[ScienceTarget]:
        return list(self._load().values())

    def get_by_id(self, target_id: str) -> ScienceTarget | None:
        return self._load().get(target_id)
