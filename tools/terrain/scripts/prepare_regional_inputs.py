
import argparse
import json
import subprocess
from pathlib import Path

from osgeo import gdal
import numpy as np

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

# Nueva extension regional de SENDA
# [oeste, sur, este, norte] en grados marcianos
REGIONAL_BBOX = [
    137.340,
    -4.821,
    137.462,
    -4.578,
]

REGIONAL_RESOLUTION_M = 10

parser = argparse.ArgumentParser(
    description="Recortar el DEM regional de SENDA desde USGS"
)

parser.add_argument(
    "--output",
    default="outputs/gale_regional_dem.tif",
    help="Ruta del GeoTIFF de salida",
)

args = parser.parse_args()

# Configuracion compartida con el procesamiento local
with open(root / "config" / "area.json", encoding="utf-8") as file:
    area = json.load(file)

output_path = Path(args.output)

if not output_path.is_absolute():
    output_path = root / output_path

output_path.parent.mkdir(parents=True, exist_ok=True)

# Evitar sobrescribir archivos existentes accidentalmente
if output_path.exists():
    raise FileExistsError(
        f"El archivo ya existe: {output_path}"
    )

command = [
    "gdalwarp",
    "-of", "GTiff",
    "-te", *[str(x) for x in REGIONAL_BBOX],
    "-te_srs", area["bbox_crs"],
    "-t_srs", area["target_crs"],
    "-tr",
    str(REGIONAL_RESOLUTION_M),
    str(REGIONAL_RESOLUTION_M),
    "-tap",
    "-r", "bilinear",
    "-srcnodata", "-32767",
    "-dstnodata", "-32767",
    "-co", "COMPRESS=LZW",
    f'/vsicurl/{area["dem_url"]}',
    str(output_path),
]

print("Generando DEM regional...")
subprocess.run(command, check=True)

# Verificar que el resultado tenga datos validos
dataset = gdal.Open(str(output_path))
band = dataset.GetRasterBand(1)
dem = band.ReadAsArray()
nodata = band.GetNoDataValue()

valid = np.isfinite(dem)

if nodata is not None:
    valid &= dem != nodata

print("\nDEM regional generado.")
print("Archivo:", output_path)
print("Dimensiones:", dataset.RasterYSize, dataset.RasterXSize)
print("Resolucion:", REGIONAL_RESOLUTION_M, "m")
print("Cobertura valida:", round(valid.mean() * 100, 2), "%")
print("Celdas sin datos:", np.count_nonzero(~valid))

if not valid.all():
    raise ValueError("El DEM regional contiene celdas sin datos")

dataset = None