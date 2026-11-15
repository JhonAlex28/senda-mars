
# SENDA — Geospatial Terrain Processing

## 1. Descripción

Este módulo contiene los scripts utilizados para generar los
datos geoespaciales de SENDA a partir de modelos digitales
de elevación del cráter Gale, Marte.

Los datos procesados permiten evaluar:

- Elevación del terreno.
- Pendiente.
- Transitabilidad para EVA y rover.
- Riesgo topográfico provisional.
- Disponibilidad de datos.

## 2. Fuentes

DEM original:

USGS — MSL Gale Merged DEM 1 m

https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif

Los datos se procesan utilizando una proyección
equirectangular marciana con radio de 3 396 190 m.

## 3. Dependencias

Se recomienda Miniforge o Miniconda.

Desde la raíz del repositorio SENDA:

```powershell
conda env create -f tools/terrain/environment.yml
conda activate senda-gis
```

El entorno incluye Python, GDAL, NumPy, SciPy y Pillow.

La generación del DEM requiere conexión a Internet para
acceder al archivo original de USGS.

## 4. Generación de la grilla regional

La grilla regional utiliza:

- Resolución: 10 m/celda.
- Dimensiones esperadas: 1442 filas × 724 columnas.
- Cobertura: 15 objetivos científicos y base de exploración.

Ejecutar los siguientes comandos desde la raíz del repositorio,
en el orden indicado:

```powershell
python tools/terrain/scripts/prepare_regional_inputs.py
python tools/terrain/scripts/generate_grid.py --scale regional
python tools/terrain/scripts/generate_dem.py
python tools/terrain/scripts/generate_slope.py
python tools/terrain/scripts/generate_classes_rover.py
python tools/terrain/scripts/generate_risk_rover.py
python tools/terrain/scripts/generate_confidence_rover.py
python tools/terrain/scripts/generate_slope_regional_png.py
python tools/terrain/scripts/generate_risk_regional_png.py
```

Nota: `prepare_regional_inputs.py` no sobrescribe un
GeoTIFF existente. Para repetir el procesamiento, conservar
o retirar explícitamente la salida anterior.

## 5. Validación de objetivos

Ejecutar:

```powershell
python tools/terrain/scripts/validate_targets_regional.py
```

Resultado esperado:

- 16 puntos evaluados.
- 16 puntos válidos.
- 0 errores.

La validación utiliza el catálogo de referencia:

`tools/terrain/config/targets_v1.geojson`

Este archivo es una copia de los objetivos entregados por
Mathías; no se sincroniza automáticamente con cambios
posteriores del catálogo del proyecto.

Esta verificación comprueba disponibilidad de datos en cada
objetivo, no conectividad ni factibilidad de rutas.

## 6. Ubicación de resultados

Los scripts generan archivos intermedios en:

- `tools/terrain/outputs/`
- `tools/terrain/data/terrain/regional/`
- `tools/terrain/data/layers/`

Estas carpetas de trabajo están excluidas de Git.

Los entregables oficiales del repositorio están en:

- `backend/data/terrain/regional/`
- `frontend/public/data/layers/`

Para publicar una nueva generación, deben copiarse los
archivos regionales desde las carpetas de procesamiento
a las ubicaciones oficiales, después de validarlos.

## 7. Limitaciones científicas

- Las clases de transitabilidad utilizan umbrales
  provisionales de pendiente.
- El riesgo regional se calcula como
  `clip(slope_deg / 25, 0, 1)`.
- La confianza indica disponibilidad de elevaciones;
  no representa precisión ni incertidumbre del DEM.
- No se modelan explícitamente arena, rocas, rugosidad
  ni propiedades geotécnicas.
- La disponibilidad de terreno no garantiza que A*
  encuentre una trayectoria transitable.

## 8. Estado de validación

La versión regional ampliada fue comprobada con:

- Cobertura válida del DEM: 100 %.
- Dimensiones: 1442 × 724.
- Verificación de dimensiones y tipos de matrices.
- Coincidencia de dimensiones y bounding box de PNG/JSON.
- Cobertura de los 15 objetivos y la base.
- Reproducción idéntica del recorte regional de USGS.

El procedimiento completo todavía no se ha probado
desde una instalación limpia.

La reproducción completa de la grilla local EVA también
requiere una comprobación independiente.

## 9. Documentación adicional

Consultar:

`docs/terrain-data.md`

Contiene las especificaciones de las grillas, sus formatos,
límites geográficos y consideraciones para el planificador.
