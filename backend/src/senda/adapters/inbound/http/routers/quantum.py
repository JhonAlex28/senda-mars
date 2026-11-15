"""Optimización opcional de objetivos con IBM Quantum / Qiskit (QAOA)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import optimize_quantum_uc
from senda.adapters.inbound.http.schemas import QuantumOptimizeIn
from senda.application.use_cases.quantum import OptimizeTargetsQuantum

router = APIRouter(prefix="/quantum", tags=["quantum"])


@router.post("/optimize-route")
def optimize_route(body: QuantumOptimizeIn,
                   uc: OptimizeTargetsQuantum = Depends(optimize_quantum_uc)) -> dict[str, Any]:
    """`mode` en la respuesta indica qué se ejecutó: ibm-qpu, qiskit-aer o classical-fallback."""
    return uc.execute(body.base.to_domain(), body.selected_goal_ids, body.speed_kmh,
                      body.qpu_backend, body.layers, body.shots, body.noise_profile)
