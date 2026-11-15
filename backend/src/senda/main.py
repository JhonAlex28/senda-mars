"""Punto de entrada FastAPI.   Ejecutar:  uvicorn senda.main:app --reload"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from senda.adapters.inbound.http.routers import (assistant, environment, health, mission, quantum,
                                                 routes, safety, simulate, targets, terrain)
from senda.container import get_container
from senda.domain.errors import InvalidRequest, NoRouteFound, OutsideSite, TargetNotFound

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    app = FastAPI(title="SENDA API", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_container().settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(TargetNotFound)
    async def _not_found(_: Request, e: TargetNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(e)})

    @app.exception_handler(InvalidRequest)
    @app.exception_handler(NoRouteFound)
    @app.exception_handler(OutsideSite)
    async def _unprocessable(_: Request, e: Exception) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(e)})

    app.include_router(health.router)
    for r in (targets.router, environment.router, terrain.router, routes.router,
              mission.router, simulate.router, safety.router, assistant.router, quantum.router):
        app.include_router(r, prefix=API_PREFIX)
    return app


app = create_app()
