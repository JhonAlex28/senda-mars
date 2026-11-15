import json
from pathlib import Path

import numpy as np
from osgeo import gdal
from PIL import Image

gdal.UseExceptions()

root = Path(__file__).resolve().parents[1]

grid_path = root / "data" / "terrain" / "regional" / "grid.json"
slope_path = root / "outputs" / "gale_regional_slope_filtered.tif"

output_dir = root / "data" / "layers"
output_dir.mkdir(parents=True, exist_ok=True)

png_path = output_dir / "slope_regional.png"
metadata_path = output_dir / "slope_regional.json"

with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

dataset = gdal.Open(str(slope_path))
slope = dataset.ReadAsArray()
nodata = dataset.GetRasterBand(1).GetNoDataValue()

if slope.shape != tuple(grid["shape"]):
    raise ValueError("Las dimensiones no coinciden con grid.json")

valid = np.isfinite(slope)
if nodata is not None:
    valid &= slope != nodata

rgba = np.zeros((*slope.shape, 4), dtype=np.uint8)

# Rover: <15 nominal, 15-25 precaucion, >25 no transitable
rgba[valid & (slope < 15)] = [46, 160, 90, 150]
rgba[valid & (slope >= 15) & (slope <= 25)] = [245, 190, 60, 170]
rgba[valid & (slope > 25)] = [220, 65, 65, 190]

Image.fromarray(rgba, mode="RGBA").save(png_path)

metadata = {
    "layer": "slope_regional",
    "scale": "regional",
    "bbox_lonlat": grid["bbox_lonlat"],
    "shape": grid["shape"],
    "units": "degrees",
    "thresholds_deg": [15, 25],
    "source": "gale_regional_slope_filtered.tif"
}

with open(metadata_path, "w", encoding="utf-8") as file:
    json.dump(metadata, file, indent=2, ensure_ascii=False)

print("Capa PNG regional de pendiente generada correctamente.")
print("Imagen:", png_path)
print("Metadatos:", metadata_path)
print("Dimensiones:", rgba.shape[:2])
print("Pixeles transparentes:", np.count_nonzero(rgba[:, :, 3] == 0))

dataset = None