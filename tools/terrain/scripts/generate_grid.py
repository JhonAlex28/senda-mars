
import argparse
import json
from pathlib import Path

from osgeo import gdal, osr

gdal.UseExceptions()
osr.UseExceptions()

root = Path(__file__).resolve().parents[1]

# Seleccionar la escala desde la terminal
parser = argparse.ArgumentParser(
    description="Generar grid.json para terreno local o regional"
)

parser.add_argument(
    "--scale",
    choices=["local", "regional"],
    required=True,
    help="Escala de la grilla que se desea generar"
)

args = parser.parse_args()
scale = args.scale

# Leer configuracion general
with open(root / "config" / "area.json", encoding="utf-8") as file:
    area = json.load(file)

# Seleccionar DEM segun la escala
dem_files = {
    "local": root / "outputs" / "gale_test_area_dem.tif",
    "regional": root / "outputs" / "gale_regional_dem.tif",
}

dem_path = dem_files[scale]

# Seleccionar carpeta de salida
output_dir = root / "data" / "terrain" / scale
output_dir.mkdir(parents=True, exist_ok=True)

grid_path = output_dir / "grid.json"

# Abrir el DEM
dem = gdal.Open(str(dem_path))

if dem is None:
    raise FileNotFoundError(f"No se encontro el DEM: {dem_path}")

width = dem.RasterXSize
height = dem.RasterYSize
transform = dem.GetGeoTransform()

# Verificar que el raster no tenga rotacion
if transform[2] != 0 or transform[4] != 0:
    raise ValueError("El DEM tiene rotacion; se requiere una grilla alineada")

# Obtener origen y resolucion
xmin = transform[0]
ymax = transform[3]
resolution = transform[1]

if resolution <= 0 or transform[5] != -resolution:
    raise ValueError("La grilla debe tener pixeles cuadrados orientados al norte")

# Usar el sistema de coordenadas del DEM
source_srs = osr.SpatialReference()
source_srs.ImportFromWkt(dem.GetProjection())

target_srs = osr.SpatialReference()
target_srs.ImportFromProj4(area["bbox_crs"])

source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

transform_coords = osr.CoordinateTransformation(
    source_srs, target_srs
)

# Calcular limites efectivos del raster
xmax = xmin + width * resolution
ymin = ymax - height * resolution

west, south, _ = transform_coords.TransformPoint(xmin, ymin)
east, north, _ = transform_coords.TransformPoint(xmax, ymax)

bbox_actual = [west, south, east, north]

# Construir metadatos para Elias
grid = {
    "scale": scale,
    "crs_proj4": source_srs.ExportToProj4(),
    "origin_xy": [xmin, ymax],
    "cell_size_m": resolution,
    "shape": [height, width],
    "bbox_lonlat": bbox_actual,
    "sources": [
        {
            "name": "MSL Gale Merged DEM 1m",
            "mission": "MRO HiRISE + CTX, MGS MOLA",
            "resolution_m": 1,
            "url": area["dem_url"]
        }
    ]
}

# Guardar archivo
with open(grid_path, "w", encoding="utf-8") as file:
    json.dump(grid, file, indent=2, ensure_ascii=False)

dem = None

print(f"grid.json {scale} generado correctamente.")
print("Archivo:", grid_path)
print(json.dumps(grid, indent=2, ensure_ascii=False))