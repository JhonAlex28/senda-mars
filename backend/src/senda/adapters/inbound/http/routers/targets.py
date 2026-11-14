from fastapi import APIRouter, Depends, HTTPException

from senda.adapters.inbound.http.dependencies import get_target_uc, list_targets_uc
from senda.adapters.inbound.http.schemas import TargetOut
from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.domain.errors import TargetNotFound

router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("", response_model=list[TargetOut])
def list_targets(uc: ListTargets = Depends(list_targets_uc)) -> list[TargetOut]:
    return [TargetOut.from_domain(t) for t in uc.execute()]


@router.get("/{target_id}", response_model=TargetOut)
def get_target(target_id: str, uc: GetTarget = Depends(get_target_uc)) -> TargetOut:
    try:
        return TargetOut.from_domain(uc.execute(target_id))
    except TargetNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
