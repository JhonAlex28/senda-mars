
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]
regional = root / "data" / "terrain" / "regional"

grid_path = regional / "grid.json"
classes_path = regional / "classes_rover.npy"
slope_path = root / "outputs" / "gale_regional_slope_filtered.tif"
output_path = regional / "risk.npy"

# Leer la grilla y las clases
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

expected_shape = tuple(grid["shape"])
classes = np.load(classes_path)

# Leer pendientes
dataset = gdal.Open(str(slope_path))
slope = dataset.ReadAsArray()
nodata = dataset.GetRasterBand(1).GetNoDataValue()

if slope.shape != expected_shape or classes.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

# Identificar celdas validas
valid = np.isfinite(slope) & (classes != 255)

if nodata is not None:
    valid &= slope != nodata

# Riesgo topografico provisional para el rover
# 0 grados -> riesgo 0
# 25 grados o mas -> riesgo 1
risk = np.full(expected_shape, np.nan, dtype=np.float32)

risk[valid] = np.clip(
    slope[valid] / 25.0,
    0.0,
    1.0
)

# Guardar
np.save(output_path, risk)

print("risk.npy regional generado correctamente.")
print("Dimensiones:", risk.shape)
print("Tipo:", risk.dtype)
print("Riesgo minimo:", np.nanmin(risk))
print("Riesgo maximo:", np.nanmax(risk))
print("Riesgo mediano:", np.nanmedian(risk))
print("Celdas NaN:", np.count_nonzero(np.isnan(risk)))
print("Archivo:", output_path)

dataset = None