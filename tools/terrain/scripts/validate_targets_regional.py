
import json
from pathlib import Path

import numpy as np
from osgeo import osr

root = Path(__file__).resolve().parents[1]

targets_path = root / "config" / "targets_v1.geojson"
regional = root / "data" / "terrain" / "regional"

# Leer objetivos y configuracion de la grilla
with open(targets_path, encoding="utf-8") as file:
    targets = json.load(file)

with open(regional / "grid.json", encoding="utf-8") as file:
    grid = json.load(file)

# Cargar datos regionales
dem = np.load(regional / "dem.npy")
classes = np.load(regional / "classes_rover.npy")
risk = np.load(regional / "risk.npy")
confidence = np.load(regional / "confidence.npy")

shape = tuple(grid["shape"])

for array in (dem, classes, risk, confidence):
    if array.shape != shape:
        raise ValueError("Dimensiones incompatibles con grid.json")

# Configurar coordenadas marcianas
source = osr.SpatialReference()
source.ImportFromProj4(
    "+proj=longlat +a=3396190 +b=3396190 +no_defs"
)

target = osr.SpatialReference()
target.ImportFromProj4(grid["crs_proj4"])

source.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
target.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

transform = osr.CoordinateTransformation(source, target)

xmin, ymax = grid["origin_xy"]
resolution = grid["cell_size_m"]
height, width = shape

valid_count = 0
errors = []

print("\n=== VALIDACION DE OBJETIVOS SENDA ===")

for feature in targets["features"]:
    properties = feature["properties"]
    identifier = properties["id"]
    lon, lat = feature["geometry"]["coordinates"][:2]

    # Convertir longitud/latitud a coordenadas proyectadas
    x, y, _ = transform.TransformPoint(lon, lat)

    # Obtener fila y columna de la grilla
    col = int(np.floor((x - xmin) / resolution))
    row = int(np.floor((ymax - y) / resolution))

    # Verificar limites
    if not (0 <= row < height and 0 <= col < width):
        errors.append(f"{identifier}: FUERA DE GRILLA")
        print(f"{identifier}: FUERA DE GRILLA")
        continue

    # Verificar disponibilidad de datos
    valid = (
        np.isfinite(dem[row, col])
        and np.isfinite(risk[row, col])
        and confidence[row, col] > 0
        and classes[row, col] != 255
    )

    if not valid:
        errors.append(f"{identifier}: CELDA SIN DATOS")
        print(f"{identifier}: CELDA SIN DATOS")
        continue

    valid_count += 1

    print(
        f"{identifier}: OK | "
        f"fila={row}, columna={col} | "
        f"elevacion={dem[row, col]:.2f} m | "
        f"clase={classes[row, col]} | "
        f"riesgo={risk[row, col]:.3f}"
    )

print("\n=== RESULTADO FINAL ===")
print("Puntos evaluados:", len(targets["features"]))
print("Puntos validos:", valid_count)
print("Errores:", len(errors))

if errors:
    raise ValueError("Existen objetivos sin cobertura valida")

print("VALIDACION DE OBJETIVOS COMPLETADA")