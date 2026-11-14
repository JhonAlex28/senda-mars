from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("")
def plan_routes() -> None:
    # TODO: conectar con application.use_cases.plan_routes.PlanRoutes
    raise HTTPException(status_code=501, detail="Route planning not implemented yet")
