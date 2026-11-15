
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

regional = root / "data" / "terrain" / "regional"

grid_path = regional / "grid.json"
dem_path = regional / "dem.npy"
slope_path = root / "outputs" / "gale_regional_slope_filtered.tif"
output_path = regional / "classes_rover.npy"

# Leer la configuracion
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

expected_shape = tuple(grid["shape"])

# Leer elevaciones y pendientes
dem = np.load(dem_path)

dataset = gdal.Open(str(slope_path))
slope = dataset.ReadAsArray()
nodata = dataset.GetRasterBand(1).GetNoDataValue()

if dem.shape != expected_shape or slope.shape != expected_shape:
    raise ValueError("Las dimensiones no coinciden con grid.json")

# Identificar celdas validas
valid = np.isfinite(dem) & np.isfinite(slope)

if nodata is not None:
    valid &= slope != nodata

# Inicializar todas las celdas como sin datos
classes = np.full(expected_shape, 255, dtype=np.uint8)

# Umbrales provisionales del rover SEV
classes[valid & (slope < 15)] = 0
classes[valid & (slope >= 15) & (slope <= 25)] = 1
classes[valid & (slope > 25)] = 2

# Guardar
np.save(output_path, classes)

print("classes_rover.npy generado correctamente.")
print("Dimensiones:", classes.shape)
print("Tipo:", classes.dtype)

for value in (0, 1, 2, 255):
    count = np.count_nonzero(classes == value)
    print(f"Clase {value}: {count} celdas")

print("Archivo:", output_path)

dataset = None