# Adaptadores de terreno

Implementaciones del puerto `TerrainProvider` (`application/ports/outbound.py`):

- `npy_dem.py` ✅ (por defecto): DEM real del USGS (*MSL Gale Merged DEM 1 m*, HiRISE + CTX + MOLA)
  exportado a NumPy en `data/terrain/{local,regional}` (ver `docs/terrain-data.md`). Elige la
  grilla de 1 m o de 10 m según la resolución pedida y promedia por bloques.
- `synthetic.py`: grilla generada por fórmula, solo como demo o respaldo (`SENDA_TERRAIN=synthetic`).

`container.py` elige uno u otro; el dominio no cambia.
