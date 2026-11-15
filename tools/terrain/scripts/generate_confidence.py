import json
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[1]

grid_path = root / "outputs" / "grid.json"
dem_path = root / "outputs" / "dem.npy"
output_path = root / "outputs" / "confidence.npy"

# Leer configuracion
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

# Leer elevaciones procesadas
dem = np.load(dem_path)

expected_shape = tuple(grid["shape"])

if dem.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

# Disponibilidad de datos:
# 1.0 = elevacion valida
# 0.0 = sin datos
# No representa precision topografica.
confidence = np.isfinite(dem).astype(np.float32)

np.save(output_path, confidence)

print("confidence.npy generado correctamente.")
print("Dimensiones:", confidence.shape)
print("Tipo:", confidence.dtype)
print("Valor minimo:", confidence.min())
print("Valor maximo:", confidence.max())
print("Celdas con datos:", np.count_nonzero(confidence == 1.0))
print("Celdas sin datos:", np.count_nonzero(confidence == 0.0))
print("Archivo:", output_path)
