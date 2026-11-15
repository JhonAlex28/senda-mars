
import json
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[1]
terrain = root / "data" / "terrain"

for scale in ("local", "regional"):
    folder = terrain / scale

    print(f"\n=== GRILLA {scale.upper()} ===")

    with open(folder / "grid.json", encoding="utf-8") as file:
        grid = json.load(file)

    expected_shape = tuple(grid["shape"])

    class_file = (
        "classes_human.npy"
        if scale == "local"
        else "classes_rover.npy"
    )

    expected_files = {
        "dem.npy": np.float32,
        class_file: np.uint8,
        "risk.npy": np.float32,
        "confidence.npy": np.float32,
    }

    for name, expected_dtype in expected_files.items():
        array = np.load(folder / name)

        shape_ok = array.shape == expected_shape
        dtype_ok = array.dtype == expected_dtype

        print(
            f"{name}: "
            f"shape={array.shape}, "
            f"dtype={array.dtype}, "
            f"compatible={shape_ok and dtype_ok}"
        )

        if not shape_ok or not dtype_ok:
            raise ValueError(f"Archivo incompatible: {name}")

    # Validaciones adicionales
    classes = np.load(folder / class_file)
    risk = np.load(folder / "risk.npy")
    confidence = np.load(folder / "confidence.npy")

    if not np.isin(classes, [0, 1, 2, 255]).all():
        raise ValueError("Clases fuera del rango permitido")

    if not np.all((risk[np.isfinite(risk)] >= 0) &
                  (risk[np.isfinite(risk)] <= 1)):
        raise ValueError("Riesgo fuera del rango [0,1]")

    if not np.all((confidence >= 0) & (confidence <= 1)):
        raise ValueError("Confianza fuera del rango [0,1]")

    print("Validacion de valores: OK")

print("\nVALIDACION FINAL COMPLETADA")
