
# SENDA — Datos geoespaciales de Gale Crater

**Responsable:** Mecatrónico A — Terreno/GIS  
**Proyecto:** NASA Space Apps Challenge 2026  
**Área:** Gale Crater, Mount Sharp, Marte  
**Versión:** 1.0 — Datos preliminares para integración

## 1. Descripción

Este paquete contiene los datos geoespaciales necesarios para el planificador de rutas de SENDA.

Se proporcionan dos grillas independientes:

- **Local:** planificación de caminatas EVA en la zona boxwork, con resolución de 1 m/celda.
- **Regional:** desplazamiento del rover presurizado desde la base propuesta hasta la zona boxwork, con resolución de 10 m/celda.

El planificador de Mecatrónico B calcula los costos direccionales de movimiento, las rutas y las condiciones de seguridad.

No se entrega `cost.npy`.

## 2. Estructura del paquete

```text
delivery/
├── README.md
├── backend/
│   └── data/
│       └── terrain/
│           ├── local/
│           │   ├── grid.json
│           │   ├── dem.npy
│           │   ├── classes_human.npy
│           │   ├── risk.npy
│           │   └── confidence.npy
│           └── regional/
│               ├── grid.json
│               ├── dem.npy
│               ├── classes_rover.npy
│               ├── risk.npy
│               └── confidence.npy
└── frontend/
    └── public/
        └── data/
            └── layers/
                ├── slope_local.png
                ├── slope_local.json
                ├── risk_local.png
                ├── risk_local.json
                ├── slope_regional.png
                ├── slope_regional.json
                ├── risk_regional.png
                └── risk_regional.json
```

## 3. Especificaciones de las grillas

| Propiedad | Local | Regional |
|---|---|---|
| Resolución | 1 m/celda | 10 m/celda |
| Filas | 2005 | 1424 |
| Columnas | 2011 | 416 |
| Celdas | 4 032 055 | 592 384 |
| Cobertura válida | 100 % | 100 % |
| Proyección | Equirectangular marciana | Equirectangular marciana |

Las dos grillas utilizan una proyección equirectangular con radio planetario de 3 396 190 m.

El origen se encuentra en la esquina superior izquierda.

Las matrices utilizan el orden `(fila, columna)`:

- Las filas aumentan hacia el sur.
- Las columnas aumentan hacia el este.

Las coordenadas geográficas se expresan como `[longitud, latitud]`.

### Extensión local

```json
[137.37203798970677, -4.812609965455096,
 137.40596477607644, -4.7787844027145745]
```

### Extensión regional

```json
[137.35995863662836, -4.820100514012099,
 137.43014035283812, -4.5798631008325374]
```

Estos límites corresponden a las extensiones efectivas de los rásteres, después de su alineación espacial mediante GDAL.

## 4. Descripción de archivos

### grid.json

Contiene:

- Escala de la grilla.
- Sistema de coordenadas PROJ4.
- Origen proyectado.
- Resolución espacial.
- Dimensiones.
- Límites geográficos.
- Procedencia del DEM.

El planificador lo utiliza para convertir coordenadas geográficas a índices de matriz y viceversa.

### dem.npy

**Formato:** `float32`  
**Unidad:** metros

Contiene las elevaciones del terreno obtenidas del producto USGS MSL Gale Merged DEM 1m.

Procesamiento:

1. Recorte geográfico.
2. Remuestreo a la resolución correspondiente.
3. Filtrado de mediana 3×3.
4. Exportación a NumPy.

Las celdas sin datos se representan mediante `NaN`.

Ambos recortes utilizados tienen cobertura válida del 100 %.

El planificador calcula la pendiente direccional a partir de estas elevaciones.

### classes_human.npy

**Escala:** local  
**Formato:** `uint8`

Clasificación provisional para astronautas:

| Valor | Condición |
|---|---|
| 0 | Pendiente menor de 10° |
| 1 | Pendiente entre 10° y 20° |
| 2 | Pendiente mayor de 20° |
| 255 | Sin datos |

Los umbrales proceden del contrato del planificador y se consideran supuestos de diseño.

### classes_rover.npy

**Escala:** regional  
**Formato:** `uint8`

Clasificación provisional para el rover:

| Valor | Condición |
|---|---|
| 0 | Pendiente menor de 15° |
| 1 | Pendiente entre 15° y 25° |
| 2 | Pendiente mayor de 25° |
| 255 | Sin datos |

Estos umbrales no constituyen límites operativos certificados de un vehículo real.

### risk.npy

**Formato:** `float32`  
**Rango:** [0, 1]

Representa un índice provisional de riesgo topográfico basado únicamente en pendiente local.

**Grilla local:**

```text
risk = clip(slope_deg / 20, 0, 1)
```

**Grilla regional:**

```text
risk = clip(slope_deg / 25, 0, 1)
```

El valor 0 representa pendiente horizontal y 1 corresponde a una pendiente igual o superior al umbral de referencia.

Limitaciones:

- No incorpora TRI ni rugosidad como componentes independientes.
- No incorpora penalización por arena.
- No incorpora detección de rocas u obstáculos.
- No constituye una probabilidad estadística de accidente.

La pendiente ya interviene en el cálculo energético direccional del planificador. Por tanto, el uso adicional de `risk.npy` introduce una preferencia por zonas de menor inclinación.

Mecatrónico B debe considerar esta dependencia al aplicar los pesos de riesgo.

### confidence.npy

**Formato:** `float32`  
**Rango:** [0, 1]

En esta versión se utiliza como indicador de disponibilidad de elevaciones:

- `1.0`: elevación válida.
- `0.0`: elevación ausente.

Todas las celdas de ambas grillas tienen valor `1.0`.

**Advertencia:** este archivo no representa incertidumbre altimétrica medida ni permite identificar diferencias de precisión entre productos HiRISE, CTX, HRSC o MOLA.

No debe interpretarse `1.0` como precisión garantizada.

En consecuencia, la alerta `LOW_CONFIDENCE` del planificador no podrá detectar regiones de menor calidad topográfica con esta versión.

## 5. Capas de visualización

Se incluyen cuatro imágenes PNG:

| Archivo | Contenido |
|---|---|
| slope_local.png | Categorías de pendiente EVA |
| risk_local.png | Riesgo topográfico local |
| slope_regional.png | Categorías de pendiente rover |
| risk_regional.png | Riesgo topográfico regional |

Cada PNG dispone de un archivo JSON asociado que contiene sus límites geográficos, dimensiones y parámetros de representación.

Las imágenes utilizan colores verde, amarillo y rojo con transparencia parcial.

Los PNG no contienen georreferenciación interna. El frontend debe utilizar `bbox_lonlat` de sus archivos JSON.

Las imágenes y sus metadatos han sido verificados dimensionalmente, pero queda pendiente comprobar su superposición visual en el frontend.

La capa de zona segura y los campos de retorno corresponden al planificador de Mecatrónico B.

## 6. Fuente de datos

**Fuente principal:** USGS Astrogeology Science Center.

**Producto:** Mars MSL Gale Merged DEM 1m.

URL:

https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m

Archivo utilizado:

`MSL_Gale_DEM_Mosaic_1m_v3.tif`

El mosaico integra productos topográficos de distintas fuentes orbitales.

La resolución nominal del ráster no garantiza una precisión espacial equivalente en todas sus celdas.

También se dispone de una ortofoto HiRISE para análisis visual, aunque no se ha utilizado para clasificar arena u obstáculos en esta entrega.

## 7. Validaciones realizadas

Se verificaron:

- Dimensiones y tipos de datos de los archivos NumPy.
- Valores permitidos de las clases.
- Rango [0, 1] de riesgo y confianza.
- Cobertura válida de ambos DEM.
- Coherencia entre dimensiones de los PNG y grillas.
- Coincidencia de los límites geográficos en los metadatos.
- Reproducibilidad de ambos `grid.json`.
- Integridad de las 18 copias mediante SHA-256.

**Resultado:** 18 archivos verificados, 18 copias idénticas y 0 errores.

Estas pruebas comprueban consistencia de archivos, no seguridad física ni conectividad de rutas.

## 8. Consideraciones de integración

1. Cada grilla debe utilizarse de forma independiente mediante `scale = local` o `regional`.
2. Todos los archivos NumPy tienen dimensiones idénticas a `shape` de su respectivo `grid.json`.
3. El planificador calcula el costo direccional entre celdas usando `dem.npy`.
4. Las clases 2 y 255 deben tratarse como no transitables.
5. `risk.npy` contiene una penalización topográfica provisional, no un modelo completo de peligros.
6. `confidence.npy` solo representa disponibilidad de datos.
7. La identificación de dunas, arena y obstáculos está pendiente.
8. La conectividad real entre la base, el staging y los objetivos debe verificarse mediante el planificador.
9. Las capas PNG deben comprobarse visualmente sobre el mapa.
10. No se proporciona `cost.npy`.

## 9. Estado de la entrega

Los datos se encuentran preparados para una primera integración con el backend y el frontend.

Quedan pendientes:

- Pruebas de rutas con A*.
- Verificación de obstáculos y características superficiales.
- Validación visual de capas.
- Evaluación de seguridad y factibilidad de las rutas.

Los resultados no deben interpretarse como certificación de transitabilidad real sobre Marte.
