
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

slope_path = root / "outputs" / "gale_test_area_slope_filtered.tif"
grid_path = root / "outputs" / "grid.json"
dem_path = root / "outputs" / "dem.npy"
output_path = root / "outputs" / "classes_human.npy"

# Leer la configuracion de la grilla
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

expected_shape = tuple(grid["shape"])

# Leer las pendientes
dataset = gdal.Open(str(slope_path))
slope = dataset.ReadAsArray()
nodata = dataset.GetRasterBand(1).GetNoDataValue()

# Leer el DEM procesado
dem = np.load(dem_path)

if slope.shape != expected_shape or dem.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

# Identificar celdas validas
valid = np.isfinite(slope) & np.isfinite(dem)

if nodata is not None:
    valid &= slope != nodata

# Inicializar todas las celdas como sin datos
classes = np.full(expected_shape, 255, dtype=np.uint8)

# Umbrales de Elias (provisionales, en grados)
classes[valid & (slope < 10)] = 0
classes[valid & (slope >= 10) & (slope <= 20)] = 1
classes[valid & (slope > 20)] = 2

# Guardar archivo
np.save(output_path, classes)

print("classes_human.npy generado correctamente.")
print("Dimensiones:", classes.shape)
print("Tipo:", classes.dtype)

for value in (0, 1, 2, 255):
    count = np.count_nonzero(classes == value)
    print(f"Clase {value}: {count} celdas")

print("Archivo:", output_path)

dataset = None
