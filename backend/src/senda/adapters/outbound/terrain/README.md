# Adaptadores de terreno

Implementaciones del puerto `TerrainProvider` (`application/ports/outbound.py`):

- `synthetic.py` ✅: grilla generada por fórmula (rampa, cráter, mesetas, crestas del boxwork), para demo.
- `geotiff_dem.py` (pendiente): DEM real USGS / HiRISE (con rasterio).

Para cambiar de uno a otro solo se modifica `container.py`; el dominio no cambia.
