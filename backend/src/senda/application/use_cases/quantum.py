"""Caso de uso: proponer objetivos con el optimizador cuántico opcional (QAOA)."""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from senda.application.ports.outbound import QuantumOptimizer, TargetRepository
from senda.domain.models.geo import GeoPoint


class OptimizeTargetsQuantum:
    def __init__(self, targets: TargetRepository, optimizer: QuantumOptimizer) -> None:
        self._targets = targets
        self._optimizer = optimizer

    def execute(self, base: GeoPoint, selected_goal_ids: Sequence[str], speed_kmh: float,
                qpu_backend: str, layers: int, shots: int, noise_profile: str) -> dict[str, Any]:
        science = [t for t in self._targets.list_all() if not t.is_base]
        return self._optimizer.optimize(base, science, selected_goal_ids, speed_kmh,
                                        qpu_backend, layers, shots, noise_profile)
