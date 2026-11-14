"""Utilidades compartidas por setup.py y dev.py (solo librería estándar)."""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
IS_WINDOWS = os.name == "nt"


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def npm() -> str:
    exe = shutil.which("npm")
    if exe is None:
        fail("No se encontró npm. Instala Node.js 20+ desde https://nodejs.org")
    return exe


def check_versions() -> None:
    if sys.version_info < (3, 11):
        fail(f"Se requiere Python 3.11+ (tienes {sys.version.split()[0]})")
    node = shutil.which("node")
    if node is None:
        fail("No se encontró Node.js. Instala Node.js 20+ desde https://nodejs.org")
    major = int(subprocess.check_output([node, "--version"], text=True).strip().lstrip("v").split(".")[0])
    if major < 20:
        fail(f"Se requiere Node.js 20+ (tienes v{major})")


def port_in_use(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def info(msg: str) -> None:
    print(f"\033[36m[senda]\033[0m {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"\033[31m[senda] ERROR:\033[0m {msg}", file=sys.stderr)
    sys.exit(1)
