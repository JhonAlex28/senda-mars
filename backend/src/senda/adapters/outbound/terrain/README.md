# Adaptadores de terreno

Implementaciones del puerto `TerrainProvider` (`application/ports/outbound.py`):

- `synthetic.py`: grillas SINTÉTICAS (mock) `local` (boxwork, 4 m) y `regional` (corredor base → boxwork, 20 m).
  El DEM local se ajusta a las elevaciones reales de los objetivos. Se marcan `kind="synthetic"`.
- `npy_terrain.py`: terreno real de Mec. A en `backend/data/terrain/<local|regional>/`:
  - obligatorio: `grid.json` + `dem.npy`
  - opcional (si falta se deriva del DEM): `classes_human.npy` (local) / `classes_rover.npy` (regional), `risk.npy`, `confidence.npy`
- `CompositeTerrainProvider`: usa el real si existe para esa escala; si no, el sintético.

Para pasar a datos reales basta con copiar los archivos en `backend/data/terrain/...` y reiniciar el backend.
Ninguna otra parte del código cambia.
