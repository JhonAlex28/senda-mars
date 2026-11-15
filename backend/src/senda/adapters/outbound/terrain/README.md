# Adaptadores de terreno

Implementaciones del puerto `TerrainProvider` (`application/ports/outbound.py`):

- `synthetic.py`: grillas SINTÉTICAS (mock) `local` (boxwork, 4 m) y `regional` (corredor base → boxwork, 20 m).
  Se marcan `kind="synthetic"`. Solo respaldo si faltan los `.npy`, o forzado con `SENDA_TERRAIN=synthetic`.
- `npy_terrain.py` ✅ (por defecto): DEM real del USGS de Mec. A en `backend/data/terrain/<local|regional>/`
  (ver `docs/terrain-data.md`):
  - obligatorio: `grid.json` + `dem.npy`
  - opcional (si falta se deriva del DEM): `classes_human.npy` (local) / `classes_rover.npy` (regional), `risk.npy`, `confidence.npy`
- `CompositeTerrainProvider`: usa el real si existe para esa escala; si no, el sintético. Submuestrea
  (reclasificando la pendiente) si la grilla supera `SENDA_MAX_PLANNING_CELLS`.

Para actualizar el terreno basta con copiar los archivos en `backend/data/terrain/...` y reiniciar el backend.
Ninguna otra parte del código cambia.
