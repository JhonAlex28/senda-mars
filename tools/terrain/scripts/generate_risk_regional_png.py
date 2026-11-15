import json
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]

grid_path = root / "data" / "terrain" / "regional" / "grid.json"
risk_path = root / "data" / "terrain" / "regional" / "risk.npy"

output_dir = root / "data" / "layers"
output_dir.mkdir(parents=True, exist_ok=True)

png_path = output_dir / "risk_regional.png"
metadata_path = output_dir / "risk_regional.json"

with open(grid_path, encoding="utf-8") as file:
    grid = json.load(file)

risk = np.load(risk_path)

if risk.shape != tuple(grid["shape"]):
    raise ValueError("Las dimensiones no coinciden con grid.json")

valid = np.isfinite(risk)

rgba = np.zeros((*risk.shape, 4), dtype=np.uint8)

# Riesgo bajo: verde
rgba[valid & (risk < 0.33)] = [46, 160, 90, 150]

# Riesgo medio: amarillo
rgba[valid & (risk >= 0.33) & (risk < 0.66)] = [245, 190, 60, 170]

# Riesgo alto: rojo
rgba[valid & (risk >= 0.66)] = [220, 65, 65, 190]

Image.fromarray(rgba, mode="RGBA").save(png_path)

metadata = {
    "layer": "risk_regional",
    "scale": "regional",
    "bbox_lonlat": grid["bbox_lonlat"],
    "shape": grid["shape"],
    "units": "normalized_risk_0_1",
    "thresholds": [0.33, 0.66],
    "source": "risk.npy"
}

with open(metadata_path, "w", encoding="utf-8") as file:
    json.dump(metadata, file, indent=2, ensure_ascii=False)

print("Capa PNG de riesgo generada correctamente.")
print("Imagen:", png_path)
print("Metadatos:", metadata_path)
print("Dimensiones:", rgba.shape[:2])
print("Pixeles transparentes:", np.count_nonzero(rgba[:, :, 3] == 0))