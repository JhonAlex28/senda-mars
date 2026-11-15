"""Genera los JSON de respaldo de la demo y los ejemplos de contrato.

Uso:  python scripts/generate_fallbacks.py
Salida:
  frontend/public/data/fallback_mission.json      (POST /api/v1/mission/plan)
  frontend/public/data/fallback_simulation.json   (POST /api/v1/simulate, sep_event)
  backend/tests/fixtures/examples/*.json          (ejemplos de request/response para el Full stack)
Vuelve a ejecutarlo cuando lleguen los .npy reales de Mec. A (backend/data/terrain/...).
"""
from __future__ import annotations

import json
import subprocess
import sys

from _common import BACKEND, FRONTEND, info, venv_python

CODE = r'''
import json, sys
from pathlib import Path
from fastapi.testclient import TestClient
from senda.main import app

out_front, out_fix = Path(sys.argv[1]), Path(sys.argv[2])
out_front.mkdir(parents=True, exist_ok=True); out_fix.mkdir(parents=True, exist_ok=True)
c = TestClient(app)

def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")

mission_req = {"target_ids": ["T02", "T05", "T06"], "profiles": ["safe", "fast", "scientific"],
               "departure": {"ltst": "06:00"}}
mission = c.post("/api/v1/mission/plan", json=mission_req); mission.raise_for_status()
dump(out_front / "fallback_mission.json", mission.json())
dump(out_fix / "mission_plan.request.json", mission_req)
dump(out_fix / "mission_plan.response.json", mission.json())

routes_req = {"target_ids": ["T02", "T05"], "profiles": ["safe", "fast", "scientific"]}
routes = c.post("/api/v1/routes", json=routes_req); routes.raise_for_status()
dump(out_fix / "routes.request.json", routes_req); dump(out_fix / "routes.response.json", routes.json())

safe = next(r for r in mission.json()["eva"]["routes"] if r["profile"] == "safe")
sim_req = {"route": {"profile": "safe", "cells": safe["cells"], "stops": safe["stops"]},
           "scenario": "sep_event", "scenario_at_index": len(safe["cells"]) // 3}
sim = c.post("/api/v1/simulate", json=sim_req); sim.raise_for_status()
dump(out_front / "fallback_simulation.json", sim.json())
dump(out_fix / "simulate.request.json", sim_req); dump(out_fix / "simulate.response.json", sim.json())

dump(out_fix / "traverse.response.json", c.post("/api/v1/traverse", json={}).json())
dump(out_fix / "return_field.response.json", c.get("/api/v1/return-field?leg=eva").json())
dump(out_fix / "scenarios.response.json", c.get("/api/v1/scenarios").json())
print("kind:", mission.json()["eva"]["grid"]["kind"], "/", mission.json()["regional_grid"]["kind"])
'''


def main() -> None:
    py = venv_python()
    if not py.exists():
        sys.exit("Falta backend/.venv: ejecuta primero  python scripts/setup.py")
    front = FRONTEND / "public" / "data"
    fix = BACKEND / "tests" / "fixtures" / "examples"
    subprocess.run([str(py), "-c", CODE, str(front), str(fix)], cwd=BACKEND, check=True)
    info(f"Respaldo escrito en {front}")
    info(f"Ejemplos de contrato en {fix}")


if __name__ == "__main__":
    main()
