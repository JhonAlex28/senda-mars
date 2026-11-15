
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

### 8.1. Validación de la grilla regional

La grilla regional ampliada de SENDA fue procesada y validada utilizando datos del DEM MSL Gale Merged DEM de USGS.

**Características verificadas:**

- Resolución espacial: 10 m/celda.
- Dimensiones: 1442 filas × 724 columnas.
- Total: 1 044 008 celdas.
- Cobertura válida del DEM: 100 %.
- Celdas sin datos: 0.
- Proyección: equirectangular marciana.

### 8.2. Reproducibilidad del procesamiento

Se ejecutaron los scripts desde el repositorio compartido `senda-mars`, utilizando el entorno `senda-gis` en Windows.

Los resultados reproducidos se compararon con los entregables oficiales del repositorio.

| Archivo | Resultado |
|---|---|
| DEM regional GeoTIFF | Elevaciones y georreferenciación idénticas |
| `grid.json` | Parámetros geoespaciales coincidentes |
| `dem.npy` | Valores idénticos |
| `classes_rover.npy` | Valores idénticos |
| `risk.npy` | Valores idénticos |
| `confidence.npy` | Valores idénticos |
| `slope_regional.png` | Píxeles idénticos |
| `risk_regional.png` | Píxeles idénticos |
| Metadatos JSON de ambas capas | Contenido idéntico |

Las matrices NumPy no presentaron diferencias respecto a los entregables publicados.

### 8.3. Validación de objetivos científicos

Se verificó la cobertura de los objetivos definidos en `targets_v1.geojson`.

**Resultados:**

- Objetivos científicos: 15.
- Base de exploración: 1.
- Puntos evaluados: 16.
- Puntos con datos válidos: 16.
- Errores: 0.

Todos los puntos evaluados se encuentran dentro de la grilla regional y disponen de valores válidos de elevación, transitabilidad y riesgo.

### 8.4. Limitaciones pendientes

- La reproducción se verificó en un entorno existente, no mediante una instalación completamente nueva.
- La grilla local EVA requiere una validación independiente de reproducibilidad.
- No se ha comprobado la conectividad de todos los objetivos mediante el algoritmo A*.
- Los umbrales de transitabilidad y el modelo de riesgo siguen siendo provisionales.
- La matriz de confianza representa disponibilidad de datos, no incertidumbre topográfica estimada.


## 9. Documentación adicional

Consultar:

`docs/terrain-data.md`

Contiene las especificaciones de las grillas, sus formatos,
límites geográficos y consideraciones para el planificador.
