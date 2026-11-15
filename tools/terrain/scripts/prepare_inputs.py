import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]

with open(root / "config" / "area.json", encoding="utf-8") as file:
    area = json.load(file)

outputs = root / "outputs"
outputs.mkdir(exist_ok=True)

bbox = [str(value) for value in area["bbox_west_south_east_north"]]
resolution = str(area["target_resolution_m"])
target_crs = area["target_crs"]
bbox_crs = area["bbox_crs"]

dem_path = outputs / "gale_test_area_dem.tif"
ortho_path = outputs / "gale_test_area_ortho.tif"
grid_path = outputs / "grid.json"


def crop_raster(url, output, resampling, dst_nodata=None):
    command = [
        "gdalwarp",
        "-overwrite",
        "-te", *bbox,
        "-te_srs", bbox_crs,
        "-t_srs", target_crs,
        "-tr", resolution, resolution,
        "-tap",
        "-r", resampling,
    ]

    if dst_nodata is not None:
        command.extend(["-dstnodata", str(dst_nodata)])

    command.extend([f"/vsicurl/{url}", str(output)])
    subprocess.run(command, check=True)


crop_raster(area["dem_url"], dem_path, "bilinear", -32767)
crop_raster(area["ortho_url"], ortho_path, "average")

slope_path = outputs / "gale_test_area_slope.tif"
mask_path = outputs / "gale_test_area_slope_valid_mask.tif"

subprocess.run(
    ["gdaldem", "slope", str(dem_path), str(slope_path), "-s", "1.0"],
    check=True,
)

subprocess.run(
    [
        "gdal_calc",
        "-A", str(slope_path),
        f"--outfile={mask_path}",
        "--calc=A!=-9999",
        "--type=Byte",
        "--NoDataValue=none",
        "--hideNoData",
        "--overwrite",
    ],
    check=True,
)

info = json.loads(
    subprocess.run(
        ["gdalinfo", "-json", str(dem_path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
)

width, height = info["size"]
transform = info["geoTransform"]

xmin = transform[0]
ymax = transform[3]
xmax = xmin + width * transform[1]
ymin = ymax + height * transform[5]

grid = {
    "scale": "local",
    "crs_proj4": target_crs,
    "origin_xy": [xmin, ymax],
    "cell_size_m": float(area["target_resolution_m"]),
    "shape": [height, width],
    "bbox_lonlat": area["bbox_west_south_east_north"],
    "sources": [
        {
            "name": "MSL Gale Merged DEM 1m",
            "mission": "MRO HiRISE + CTX, MGS MOLA",
            "resolution_m": 1,
            "url": area["dem_url"]
        }
    ]
}

with open(grid_path, "w", encoding="utf-8") as file:
    json.dump(grid, file, indent=2, ensure_ascii=False)

print("Recortes y grid.json creados correctamente.")
print(f"DEM: {dem_path}")
print(f"Ortofoto: {ortho_path}")
print(f"Grilla: {grid_path}")
print(f"Tamaño: {width} columnas x {height} filas")