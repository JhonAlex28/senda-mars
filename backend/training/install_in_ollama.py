"""Instala el modelo ajustado (GGUF exportado desde Colab) en Ollama como "senda-copilot".

Reutiliza la plantilla de chat y los parámetros del modelo base (qwen3:1.7b), que ya soportan
herramientas; solo cambia el archivo de pesos. Así producción y entrenamiento usan el mismo
formato de conversación.

Uso (desde backend/):
    python training/install_in_ollama.py C:\\ruta\\senda-copilot.Q4_K_M.gguf [--name senda-copilot] [--base qwen3:1.7b]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("gguf", type=Path, help="archivo .gguf descargado de Colab")
    ap.add_argument("--name", default="senda-copilot")
    ap.add_argument("--base", default="qwen3:1.7b", help="modelo del que se copia la plantilla")
    args = ap.parse_args()

    gguf = args.gguf.resolve()
    if not gguf.is_file():
        sys.exit(f"No existe {gguf}")
    try:
        base = subprocess.run(["ollama", "show", args.base, "--modelfile"], capture_output=True,
                              text=True, encoding="utf-8", check=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        sys.exit(f"No pude leer la plantilla de {args.base}. ¿Está Ollama instalado y el modelo "
                 f"descargado (ollama pull {args.base})? {e}")

    lines = [f"FROM {gguf}" if line.startswith("FROM ") else line for line in base.splitlines()]
    # Respuestas operativas y estables, como en el backend
    lines = [line for line in lines if not line.startswith("PARAMETER temperature")]
    lines.append("PARAMETER temperature 0.2")
    modelfile = gguf.with_name("Modelfile.senda")
    modelfile.write_text("\n".join(lines) + "\n", encoding="utf-8")

    subprocess.run(["ollama", "create", args.name, "-f", str(modelfile)], check=True)
    print(f"\nListo: modelo '{args.name}' creado. Pruébalo con el examen:\n"
          f"  python eval/run_eval.py --model {args.name}\n"
          f"Para usarlo en la app: SENDA_LLM_MODEL={args.name} en backend/.env")


if __name__ == "__main__":
    main()
