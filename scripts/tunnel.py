"""Publica el Ollama de esta laptop en internet con un túnel de Cloudflare, para que el backend
en la nube (Render) use el copiloto.   Uso:  python scripts/tunnel.py [--model senda-copilot-v2]

Comprueba que Ollama responde y tiene el modelo, abre el túnel, espera a que la URL pública
funcione y la copia al portapapeles. Ctrl+C cierra el túnel.

La URL cambia cada vez que se abre: hay que pegarla en Render (SENDA_OLLAMA_URL).
No la publiques: cualquiera que la tenga puede usar el Ollama de esta laptop."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from _common import IS_WINDOWS, fail, info

OLLAMA = "http://localhost:11434"
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def _get_json(url: str, timeout: float) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as res:   # noqa: S310 (URL fija)
            return json.loads(res.read())
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None


def _cloudflared() -> str:
    found = shutil.which("cloudflared")
    if found:
        return found
    # Recién instalado con winget, el PATH de esta terminal aún no lo ve
    for p in (Path(r"C:\Program Files (x86)\cloudflared\cloudflared.exe"),
              Path(r"C:\Program Files\cloudflared\cloudflared.exe")):
        if p.is_file():
            return str(p)
    fail("No encuentro cloudflared. Instálalo con:  winget install --id Cloudflare.cloudflared -e\n"
         "        (Mac: brew install cloudflared). Luego abre una terminal nueva.")
    raise SystemExit  # fail() ya sale; esto es para el verificador de tipos


def _check_ollama(model: str) -> None:
    tags = _get_json(f"{OLLAMA}/api/tags", timeout=3)
    if tags is None:
        fail("Ollama no responde en localhost:11434. Ábrelo (menú Inicio → Ollama) y vuelve a probar.")
    names = {m.get("name") for m in tags.get("models", [])}
    if model not in names and f"{model}:latest" not in names:
        fail(f"Ollama no tiene el modelo '{model}'. Disponibles: {', '.join(sorted(n for n in names if n))}")


def _copy(text: str) -> bool:
    try:
        cmd = ["clip"] if IS_WINDOWS else (["pbcopy"] if sys.platform == "darwin" else ["xclip", "-sel", "clip"])
        subprocess.run(cmd, input=text.encode(), check=True, capture_output=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="senda-copilot-v2", help="modelo que usará el backend")
    args = ap.parse_args()

    _check_ollama(args.model)
    info(f"Ollama listo con {args.model}. Abriendo el túnel…")
    proc = subprocess.Popen(
        [_cloudflared(), "tunnel", "--no-autoupdate", "--url", OLLAMA,
         "--http-host-header", "localhost:11434"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
    )

    # cloudflared escribe la URL en su salida; se lee en un hilo para no bloquear
    found: list[str] = []

    def read() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            if not found and (m := URL_RE.search(line)):
                found.append(m.group(0))

    threading.Thread(target=read, daemon=True).start()
    try:
        deadline = time.time() + 60
        while not found and proc.poll() is None and time.time() < deadline:
            time.sleep(0.5)
        if not found:
            proc.terminate()
            fail("cloudflared no entregó una URL en 60 s. ¿Hay conexión a internet?")
        url = found[0]

        # La URL tarda unos segundos en propagarse por Cloudflare. Preguntar demasiado pronto hace
        # que Windows guarde en caché "no existe" durante minutos: se espera un poco antes
        info("Túnel abierto, comprobando que responde desde internet…")
        time.sleep(3)
        for _ in range(30):
            if _get_json(f"{url}/api/tags", timeout=10) is not None:
                break
            time.sleep(2)
        else:
            info("La URL todavía no responde; puede tardar un poco más.")

        copied = _copy(url)
        line = "═" * (len(url) + 4)
        print(f"\n  ╔{line}╗\n  ║  {url}  ║\n  ╚{line}╝")
        print(f"  {'Copiada al portapapeles. ' if copied else ''}Pégala en Render → Environment:\n")
        print(f"    SENDA_OLLAMA_URL        = {url}")
        print(f"    SENDA_LLM_MODEL         = {args.model}")
        print("    SENDA_ASSISTANT_ENABLED = true")
        print("    SENDA_LLM_THINK         = false\n")
        info("Deja esta ventana abierta mientras quieras el copiloto en línea. Ctrl+C para cerrar.")
        info("No compartas la URL: cualquiera que la tenga puede usar el Ollama de esta laptop.")
        proc.wait()
        fail("El túnel se cerró. Vuelve a ejecutar el script (la URL será otra).")
    except KeyboardInterrupt:
        info("Cerrando el túnel…")
        proc.terminate()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
