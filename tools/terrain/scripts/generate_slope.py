import json
import numpy as np
from pathlib import Path
from osgeo import gdal

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

dem_npy_path = root / "data" / "terrain" / "regional" / "dem.npy"
dem_tif_path = root / "outputs" / "gale_regional_dem.tif"
grid_path = root / "data" / "terrain" / "regional" / "grid.json"
slope_path = root / "outputs" / "gale_regional_slope_filtered.tif"

# Leer la matriz de elevaciones filtrada
dem = np.load(dem_npy_path)

with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

if dem.shape != tuple(grid["shape"]):
    raise ValueError("Las dimensiones del DEM no coinciden con grid.json")

# Leer la georreferenciación original
source = gdal.Open(str(dem_tif_path))

# Crear un GeoTIFF temporal con el DEM filtrado
filtered_path = root / "outputs" / "gale_regional_dem_filtered.tif"

driver = gdal.GetDriverByName("GTiff")
filtered = driver.Create(
    str(filtered_path),
    dem.shape[1],
    dem.shape[0],
    1,
    gdal.GDT_Float32
)

filtered.SetGeoTransform(source.GetGeoTransform())
filtered.SetProjection(source.GetProjection())

band = filtered.GetRasterBand(1)
band.WriteArray(np.where(np.isfinite(dem), dem, -32767))
band.SetNoDataValue(-32767)
band.FlushCache()

filtered = None
source = None

# Calcular pendientes en grados
gdal.DEMProcessing(
    str(slope_path),
    str(filtered_path),
    "slope",
    options=gdal.DEMProcessingOptions(
        slopeFormat="degree",
        scale=1.0,
        computeEdges=True
    )
)

print("Mapa de pendientes filtrado generado correctamente.")
print("Archivo:", slope_path)