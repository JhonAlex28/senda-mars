"""Instala todo el proyecto.   Uso:  python scripts/setup.py"""
from __future__ import annotations

import subprocess
import sys

from _common import BACKEND, FRONTEND, VENV, check_versions, info, npm, venv_python


def main() -> None:
    check_versions()

    if not venv_python().exists():
        info("Creando entorno virtual en backend/.venv ...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)

    info("Instalando dependencias del backend ...")
    subprocess.run([str(venv_python()), "-m", "pip", "install", "-q", "--upgrade", "pip"], check=True)
    subprocess.run([str(venv_python()), "-m", "pip", "install", "-q", "-e", ".[dev]"], cwd=BACKEND, check=True)

    info("Instalando dependencias del frontend ...")
    subprocess.run([npm(), "install", "--no-fund", "--no-audit"], cwd=FRONTEND, check=True)

    info("Listo. Ahora ejecuta:  python scripts/dev.py")


if __name__ == "__main__":
    main()
