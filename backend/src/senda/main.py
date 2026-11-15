"""Punto de entrada FastAPI.   Ejecutar:  uvicorn senda.main:app --reload"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from senda.adapters.inbound.http.routers import (assistant, environment, health, quantum, routes,
                                                targets, terrain)
from senda.container import get_container

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    app = FastAPI(title="SENDA API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_container().settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    for r in (targets.router, environment.router, terrain.router, routes.router,
              assistant.router, quantum.router):
        app.include_router(r, prefix=API_PREFIX)
    return app


app = create_app()
