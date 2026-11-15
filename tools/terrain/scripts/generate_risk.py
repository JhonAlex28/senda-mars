
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

grid_path = root / "outputs" / "grid.json"
slope_path = root / "outputs" / "gale_test_area_slope_filtered.tif"
classes_path = root / "outputs" / "classes_human.npy"
output_path = root / "outputs" / "risk.npy"

with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

classes = np.load(classes_path)

dataset = gdal.Open(str(slope_path))
slope = dataset.ReadAsArray()
nodata = dataset.GetRasterBand(1).GetNoDataValue()

expected_shape = tuple(grid["shape"])

if slope.shape != expected_shape or classes.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

valid = np.isfinite(slope) & (classes != 255)

if nodata is not None:
    valid &= slope != nodata

# Riesgo topografico provisional:
# 0 grados -> riesgo 0
# 20 grados o mas -> riesgo 1
risk = np.zeros(expected_shape, dtype=np.float32)

risk[valid] = np.clip(
    slope[valid] / 20.0,
    0.0,
    1.0
)

# Las celdas sin datos no reciben un riesgo artificial.
risk[~valid] = np.nan

np.save(output_path, risk)

print("risk.npy generado correctamente.")
print("Dimensiones:", risk.shape)
print("Tipo:", risk.dtype)
print("Riesgo minimo:", np.nanmin(risk))
print("Riesgo maximo:", np.nanmax(risk))
print("Riesgo mediano:", np.nanmedian(risk))
print("Celdas NaN:", np.count_nonzero(np.isnan(risk)))
print("Archivo:", output_path)

dataset = None
