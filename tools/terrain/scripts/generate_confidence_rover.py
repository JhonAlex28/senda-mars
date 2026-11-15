
import json
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[1]
regional = root / "data" / "terrain" / "regional"

grid_path = regional / "grid.json"
dem_path = regional / "dem.npy"
output_path = regional / "confidence.npy"

# Leer la configuracion regional
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

# Leer el DEM regional procesado
dem = np.load(dem_path)

expected_shape = tuple(grid["shape"])

if dem.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

# Disponibilidad de elevaciones:
# 1.0 = dato disponible
# 0.0 = dato ausente
# No representa precision topografica.
confidence = np.isfinite(dem).astype(np.float32)

# Guardar
np.save(output_path, confidence)

print("confidence.npy regional generado correctamente.")
print("Dimensiones:", confidence.shape)
print("Tipo:", confidence.dtype)
print("Valor minimo:", confidence.min())
print("Valor maximo:", confidence.max())
print("Celdas con datos:", np.count_nonzero(confidence == 1.0))
print("Celdas sin datos:", np.count_nonzero(confidence == 0.0))
print("Archivo:", output_path)
