"""HTTP router for IBM Quantum QAOA route optimization."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from senda.adapters.quantum_qiskit import optimize_route_qaoa

router = APIRouter(prefix="/quantum", tags=["quantum"])


class GeoPointIn(BaseModel):
    lon: float
    lat: float


class QuantumOptimizeRequest(BaseModel):
    base: GeoPointIn
    selected_goal_ids: list[str] = Field(default_factory=list)
    speed_kmh: float = 8.0
    qpu_backend: str = "ibm_brisbane"
    ibm_token: str | None = None
    layers: int = Field(default=2, ge=1, le=3)
    shots: int = Field(default=1024, ge=128, le=4096)
    noise_profile: str = "ideal"


@router.post("/optimize-route")
def optimize_route_endpoint(body: QuantumOptimizeRequest) -> dict:
    return optimize_route_qaoa(
        base={"lon": body.base.lon, "lat": body.base.lat},
        selected_goal_ids=body.selected_goal_ids,
        speed_kmh=body.speed_kmh,
        qpu_backend=body.qpu_backend,
        ibm_token=body.ibm_token,
        layers=body.layers,
        shots=body.shots,
        noise_profile=body.noise_profile,
    )
