from fastapi import APIRouter, Depends

from senda.adapters.inbound.http.dependencies import get_environment_uc
from senda.adapters.inbound.http.schemas import EnvironmentOut
from senda.application.use_cases.environment import GetEnvironment

router = APIRouter(prefix="/environment", tags=["environment"])


@router.get("", response_model=EnvironmentOut)
def get_environment(uc: GetEnvironment = Depends(get_environment_uc)) -> EnvironmentOut:
    return EnvironmentOut.from_domain(uc.execute())
