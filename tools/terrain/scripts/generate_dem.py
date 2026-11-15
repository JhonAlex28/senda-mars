import json
import numpy as np
from pathlib import Path
from osgeo import gdal
from scipy.ndimage import median_filter

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

dem_path = root / "outputs" / "gale_regional_dem.tif"
grid_path = root / "data" / "terrain" / "regional" / "grid.json"
output_path = root / "data" / "terrain" / "regional" / "dem.npy"

# Leer la configuración de la grilla
with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

# Leer el DEM
dataset = gdal.Open(str(dem_path))
dem = dataset.ReadAsArray().astype(np.float32)

# Identificar celdas sin datos
nodata = dataset.GetRasterBand(1).GetNoDataValue()
valid_mask = np.isfinite(dem)

if nodata is not None:
    valid_mask &= dem != nodata

dem[~valid_mask] = np.nan

# Verificar dimensiones
expected_shape = tuple(grid["shape"])

if dem.shape != expected_shape:
    raise ValueError(
        f"Dimensiones incorrectas: {dem.shape} != {expected_shape}"
    )

# Aplicar filtro de mediana 3x3
# El DEM local ya fue comprobado: tiene 100 % de celdas válidas.
if not valid_mask.all():
    raise ValueError(
        "El DEM contiene celdas sin datos. "
        "Se requiere un filtrado que preserve correctamente NaN."
    )

dem_filtered = median_filter(dem, size=3, mode="nearest")

# Guardar matriz NumPy
np.save(output_path, dem_filtered.astype(np.float32))

# Mostrar resultados
print("dem.npy generado correctamente.")
print("Dimensiones:", dem_filtered.shape)
print("Tipo de datos:", dem_filtered.dtype)
print("Elevacion minima:", np.nanmin(dem_filtered))
print("Elevacion maxima:", np.nanmax(dem_filtered))
print("Celdas NaN:", np.isnan(dem_filtered).sum())
print("Archivo:", output_path)

dataset = None