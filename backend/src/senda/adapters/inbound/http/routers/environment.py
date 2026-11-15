from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import assess_readiness_uc, get_environment_uc
from senda.adapters.inbound.http.schemas import EnvironmentOut, ReadinessOut
from senda.application.use_cases.environment import AssessReadiness, GetEnvironment

router = APIRouter(prefix="/environment", tags=["environment"])


@router.get("", response_model=EnvironmentOut)
def get_environment(uc: GetEnvironment = Depends(get_environment_uc)) -> EnvironmentOut:
    return EnvironmentOut.from_domain(uc.execute())


@router.get("/readiness", response_model=ReadinessOut)
def get_readiness(uc: AssessReadiness = Depends(assess_readiness_uc)) -> ReadinessOut:
    """¿Se puede salir hoy? Veredicto GO / CAUTION / NO-GO con cada medición y su fuente."""
    return ReadinessOut.from_domain(uc.execute())
