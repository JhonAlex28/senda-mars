"""Arranca backend y frontend juntos.   Uso:  python scripts/dev.py
Ctrl+C detiene ambos, incluidos todos sus procesos hijos."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time

from _common import BACKEND, FRONTEND, IS_WINDOWS, fail, info, npm, port_in_use, venv_python

BACKEND_PORT = 8000
FRONTEND_PORT = 5173


def _windows_kill_children_on_exit() -> None:
    """Mete este proceso en un Job Object de Windows con KILL_ON_JOB_CLOSE.
    Todos los procesos que lancemos (y los hijos de esos, p. ej. el worker de
    uvicorn --reload o el node de vite) heredan el job, y Windows los mata a
    todos cuando este script termina, aunque sea por un cierre inesperado."""
    import ctypes
    from ctypes import wintypes

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

    class BASIC_LIMIT(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64),
            ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class EXTENDED_LIMIT(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", BASIC_LIMIT),
            ("IoInfo", IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
    JobObjectExtendedLimitInformation = 9

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.CreateJobObjectW.restype = wintypes.HANDLE
    k32.GetCurrentProcess.restype = wintypes.HANDLE
    job = k32.CreateJobObjectW(None, None)
    limits = EXTENDED_LIMIT()
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    ok = k32.SetInformationJobObject(wintypes.HANDLE(job), JobObjectExtendedLimitInformation,
                                     ctypes.byref(limits), ctypes.sizeof(limits))
    ok = ok and k32.AssignProcessToJobObject(wintypes.HANDLE(job),
                                             wintypes.HANDLE(k32.GetCurrentProcess()))
    if not ok:
        info("Aviso: no se pudo crear el Job Object; al salir revisa que no queden procesos.")
    # El handle se mantiene abierto a propósito: se cierra al terminar este proceso.


def spawn(cmd: list[str], cwd) -> subprocess.Popen:
    kwargs = {} if IS_WINDOWS else {"start_new_session": True}
    return subprocess.Popen(cmd, cwd=cwd, **kwargs)


def stop(proc: subprocess.Popen) -> None:
    if IS_WINDOWS:
        return  # el Job Object se encarga al salir
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass


def main() -> None:
    if not venv_python().exists() or not (FRONTEND / "node_modules").exists():
        fail("Falta instalar. Ejecuta primero:  python scripts/setup.py")
    for port, name in ((BACKEND_PORT, "backend"), (FRONTEND_PORT, "frontend")):
        if port_in_use(port):
            fail(f"El puerto {port} ({name}) ya está en uso. Cierra el proceso que lo ocupa.")

    if IS_WINDOWS:
        _windows_kill_children_on_exit()

    info(f"Backend  -> http://localhost:{BACKEND_PORT}/docs")
    backend = spawn([str(venv_python()), "-m", "uvicorn", "senda.main:app",
                     "--reload", "--port", str(BACKEND_PORT)], BACKEND)
    info(f"Frontend -> http://localhost:{FRONTEND_PORT}")
    frontend = spawn([npm(), "run", "dev", "--", "--port", str(FRONTEND_PORT), "--strictPort"], FRONTEND)

    procs = [backend, frontend]
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(0.5)
        info("Uno de los procesos terminó; deteniendo todo ...")
    except KeyboardInterrupt:
        info("Deteniendo ...")
    finally:
        for p in procs:
            stop(p)
    sys.exit(0)


if __name__ == "__main__":
    main()
