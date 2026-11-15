# Contexto de desarrollo — Planificación y Seguridad

> Documento autocontenido. Sirve de contexto para cualquier colaborador o sesión de IA (por ejemplo, Claude Code) que no participó en la planificación. Describe la experiencia que construimos, mi alcance (tramo en **rover** + **EVA** a pie + **seguridad**), los algoritmos, los datos NASA y los **contratos de entrada/salida** con el resto del equipo.
>
> Está alineado con la estructura real del repo ([README](../README.md)) y con el flujo de trabajo de [CONTRIBUTING.md](../CONTRIBUTING.md). Si algo de aquí contradice al código, manda el código: actualiza este documento en el mismo PR.
>
> **Etiquetas de dato** (mismo criterio que `kind` en `env.json`): **medido** (instrumento NASA), **modelado** (derivado con un modelo publicado), **supuesto** (decisión nuestra, declarada en la UI), **a verificar** (falta confirmar contra una fuente primaria; no presentarlo como dato).

---

## 0. Contexto del proyecto

**Evento:** NASA Space Apps 2026, 14–15 nov. Entrega: domingo 15, 23:59 (Lima). **Feature freeze: domingo 15:00.**
**Challenge:** *Interplanetary Survival Guide: Martian Map*. Una vista integrada y por capas de un lugar de Marte, con datos de varias misiones NASA, para que un astronauta **planifique y ejecute una salida segura** haciendo ciencia en el trayecto. La seguridad (pendiente, radiación, consumibles, retorno) es prioridad.

### 0.1 Experiencia de la interfaz (lo que ve el usuario, que actúa como astronauta)

```
 (1) Globo de Marte          (2) Gale Crater              (3) Tramo ROVER (SEV)          (4) EVA a pie
 ┌──────────────────┐        ┌──────────────────────┐     ┌────────────────────────┐     ┌───────────────────────┐
 │ bases/EZ: Jezero,│ clic → │ Base/hábitat (Calef  │  →  │ Base → staging (T01)   │  →  │ T01 → T02…T08 → T01   │
 │ Gale, … (estático)│ Gale  │ 2015) + corredor     │     │ ~11–15 km, ~+765 m     │     │ boxwork 2×2 km, 1 m   │
 └──────────────────┘        │ hacia el boxwork     │     │ grilla regional 10 m   │     │ 3 perfiles, PNR, HUD  │
                             └──────────────────────┘     └────────────────────────┘     └───────────────────────┘
```

1. **Globo:** varias bases/Zonas de Exploración (EZ) como si ya existieran (las propuestas del *First Landing Site/Exploration Zone Workshop*, NASA 2015). Solo **Gale** es interactiva en la demo. Capa estática del frontend.
2. **Gale:** se muestra la **base/hábitat** en el sitio propuesto por **Calef et al. (2015)**: **137.42009295°E, 4.59310427°S** (`[137.42009295, -4.59310427]`), en la elipse final de aterrizaje de MSL (§7, nota de procedencia). Alrededor van la EZ de 100 km y la EZ interna de 25 km, y desde ahí el corredor hacia Mount Sharp.
3. **Rover presurizado (NASA SEV):** la planificación **empieza en la base**. Los objetivos científicos del boxwork están lejos (**12.1 km en línea recta** entre la base y el centro del sitio; 11.4 km hasta T01, calculados con `GeoPoint.distance_to`), así que el traslado se hace en rover hasta un punto de **staging** (por defecto **T01**, Rustic Canyon). La tripulación va sin traje.
4. **EVA:** desde el SEV estacionado, la tripulación sale por los *suitports* y camina por las zonas de valor científico (T02–T08). Aquí está el detalle fino: los objetivos concretos, las paradas de muestreo y la pendiente a escala de 1 m. El **refugio seguro de la EVA es el SEV**, no la base.

### 0.2 Línea de tiempo por sol (la calcula el planificador)
La ventana EVA es **09:30–15:30 LTST** (`env.json → eva_window`, 360 min). Con ~15 km de ruta real a 3–5 km/h efectivos (**supuesto**), el traslado tarda ~3–5 h y **no cabe junto con la EVA en el mismo sol** sin manejar de noche. Plan por defecto:

| Sol | Actividad | Tramo |
|---|---|---|
| N | Salida de la base después del amanecer (05:48) → traslado → pernocte en el SEV en el staging | rover |
| N+1 | EVA 09:30–15:30 → regreso al SEV → pernocte | eva |
| N+2 | Regreso a la base | rover |

Regla **supuesta**: no se maneja entre la puesta (17:52) y el amanecer. El SEV soporta 14 días de cabina (NASA), así que pernoctar no es una limitante.

### 0.3 Requerimientos (FRDPARRC) y dueños

| RF | Descripción | Dueño |
|---|---|---|
| RF-1 | Integrar ≥3 tipos de datos de ≥2 misiones en una referencia común, con procedencia | Full stack (visor) + Mec. A (datos) |
| RF-2 | Evaluar riesgos del entorno: terreno, ambiente, radiación | Mec. A (terreno) + Estudiante (ambiente, radiación) |
| RF-3 | Identificar y priorizar objetivos científicos | Estudiante |
| **RF-4** | **Planificar la misión: traslado en rover + rutas EVA que maximicen ciencia dentro del presupuesto de consumibles** | **Mec. B (yo)** |
| **RF-5** | **Acompañar la ejecución y garantizar retorno seguro (al SEV y a la base)** | **Mec. B (yo)** |

**Idea central:** cada tramo usa **una sola unidad de costo**, la misma que consume.
- **EVA:** energía metabólica (kJ) → O₂ (L) y tiempo (min).
- **Rover:** energía eléctrica (kWh) → batería (%) y tiempo (min).

El planificador minimiza lo que se consume, y el retorno se calcula en esa misma unidad.

### 0.4 ¿Hace falta un rover NO presurizado? (decisión: no, para el MVP)
- **Con un rover no presurizado** (tipo LRV de Apolo), la tripulación viaja con traje: el O₂ del PLSS se gasta también durante el traslado. Además aplica la **restricción de *walkback***, que exige poder volver caminando a la base si el vehículo falla. El *EVA Walkback Test* de NASA (Norcross et al., NASA/TP-2009-214796) evaluó la factibilidad de **10 km** con traje. Nuestra base está a **~12 km** del staging: con un solo vehículo no presurizado, la misión **no cumpliría** esa regla, salvo con dos vehículos (*drive-back*).
- **Con el SEV presurizado**, el traslado no consume consumibles del traje y el refugio de la EVA queda **a cientos de metros** (el SEV estacionado), no a 12 km. Si hay una emergencia, el SEV puede ir hacia la tripulación (*rideback*, S-8).
- **Impacto en el MVP:** un vehículo no presurizado agregaría un tercer modelo de costo (O₂ durante el manejo), otra regla de seguridad y otro perfil de UI. **Queda como trabajo futuro.** Nos quedamos con el SEV.

---

## 1. Equipo y fronteras de responsabilidad

| Rol | Produce | Consume | Me entrega |
|---|---|---|---|
| **Mec. A — Terreno/GIS** | Grillas `local` (boxwork, 1–2 m) y `regional` (corredor base→boxwork, 10 m): `grid.json`, `dem.npy`, `classes_human.npy`, `classes_rover.npy`, `risk.npy`, `confidence.npy`; capas PNG para el mapa | — | Todo el insumo de terreno (§4.2) |
| **Mec. B — Planner/Safety (yo)** | Dominio y casos de uso de rover, EVA, seguridad y misión; `mission_params.json`; DTOs de ruta/simulación; fixtures | Terreno, objetivos, ambiente | — |
| **Full stack — Integrador** | Routers FastAPI, `container.py`, frontend React + OpenLayers (`features/map`, `route-planning`, `field-simulation`), globo, despliegue | Mis casos de uso y DTOs | Requests desde la UI (§4.4) |
| **Estudiante — Datos NASA y ciencia** | `targets_v0.geojson`, `env.json`, `sites.geojson` (nuevo) | — | Objetivos con rúbrica, ambiente, radiación, bases |

**Reglas de frontera**
- Yo **no** toco GDAL/rasterio ni rásteres crudos. Recibo arrays `.npy` ya alineados a `grid.json`. El backend no reprocesa terreno en tiempo de ejecución.
- Mi lógica vive en `domain/` como **funciones puras** (sin FastAPI ni I/O), probadas con pytest. Los casos de uso en `application/` orquestan. El acceso a archivos va en `adapters/outbound/`.
- Las constantes supuestas viven en `mission_params.json` (mío) o en `env.json` (Estudiante) y **se devuelven en `assumptions`** para que la UI las muestre.

---

## 2. Estructura del repositorio (real) y dónde va mi código

Arquitectura hexagonal. **Regla de dependencias:** `adapters → application → domain`. Leyenda: ✅ existe · 🆕 a crear por mí · 🔧 a modificar.

```
backend/
├── pyproject.toml                         🔧 agregar numpy, scipy  (PR build(backend))
├── data/
│   ├── targets_v0.geojson                 ✅ Estudiante
│   ├── env.json                           ✅ Estudiante
│   ├── sites.geojson                      🆕 Estudiante: bases/EZ del globo + base Calef
│   ├── mission_params.json                🆕 Mec. B: SEV, políticas EVA, perfiles
│   └── terrain/
│       ├── local/    grid.json dem.npy classes_human.npy risk.npy confidence.npy     🆕 Mec. A
│       └── regional/ grid.json dem.npy classes_rover.npy risk.npy confidence.npy     🆕 Mec. A
├── src/senda/
│   ├── domain/
│   │   ├── models/
│   │   │   ├── geo.py                     ✅ GeoPoint, BoundingBox
│   │   │   ├── grid.py                    🆕 GridSpec: (fila,col) ↔ (x,y) ↔ (lon,lat). ÚNICO lugar de conversión
│   │   │   ├── terrain.py                 🔧 TerrainGrid con arrays numpy + GridSpec + scale
│   │   │   ├── route.py                   🔧 RouteProfile (safe|fast|scientific), RoutePlan + métricas, Segment
│   │   │   ├── mission.py                 🆕 MissionPlan, Leg(kind=rover|eva), Stop, SolActivity
│   │   │   └── params.py                  🆕 EvaParams, RoverParams (dataclasses inmutables)
│   │   └── services/
│   │       ├── pathfinding.py             🔧 astar() con arrays numpy (misma firma); dijkstra_field()
│   │       ├── physics.py → metabolic.py  🔧 Pandolf, O₂, dosis (EVA)
│   │       ├── rover_energy.py            🆕 energía eléctrica por arista (rover)
│   │       ├── return_field.py            🆕 campo de retorno (al SEV o a la base)
│   │       ├── safety_rules.py            🆕 PNR, reglas de alerta
│   │       ├── scenarios.py               🆕 efectos de contingencias
│   │       └── simulation.py              🆕 reproducción de la EVA (timeline)
│   ├── application/
│   │   ├── ports/outbound.py              🔧 TerrainProvider.get_grid(scale), MissionParamsRepository, SiteRepository
│   │   └── use_cases/
│   │       ├── plan_routes.py             🔧 PlanRoutes = rutas EVA (3 perfiles)
│   │       ├── plan_traverse.py           🆕 PlanTraverse = rover base → staging (y vuelta)
│   │       ├── plan_mission.py            🆕 PlanMission = rover + EVA + timeline por sol
│   │       ├── simulate_eva.py            🆕 SimulateEva (+ replanificación)
│   │       └── return_field.py            🆕 GetReturnField (cacheado por escenario)
│   ├── adapters/
│   │   ├── inbound/http/routers/          🔧 routes.py; 🆕 traverse.py, mission.py, simulate.py, safety.py (Full stack conecta)
│   │   ├── inbound/http/schemas.py        🔧 DTOs de ruta/misión/simulación (los defino yo)
│   │   └── outbound/
│   │       ├── persistence/json_params.py 🆕 lee mission_params.json (+ physiology de env.json)
│   │       └── terrain/
│   │           ├── synthetic.py           🆕 grilla sintética (mock)
│   │           └── npy_terrain.py         🆕 carga los .npy de Mec. A una vez (cache)
│   └── container.py                       🔧 registrar adaptadores nuevos
└── tests/
    ├── fixtures/                          🆕 synthetic_grid(), ejemplos JSON de respuesta
    ├── unit/                              ✅ test_pathfinding, test_physics → 🆕 tests de §7
    └── integration/test_api.py            🔧 reemplazar test_routes_not_implemented_yet

frontend/src/features/
├── map/              🚧 Full stack: OpenLayers, capas, rutas, isolínea zona segura
├── route-planning/   🚧 Full stack: comparador de 3 rutas EVA + tramo rover + timeline por sol
└── field-simulation/ 🚧 Full stack: HUD, alertas, escenarios, replanificación
```

**Cómo agrego una funcionalidad** (README §"Cómo agregar una funcionalidad"): dominio → puerto (si hace falta) → caso de uso → adaptador + `container.py` → router + DTO → tests (unitario con fake, integración con `TestClient`).

---

## 3. Mis funcionalidades

### M — Misión (integra los dos tramos)
| ID | Funcionalidad | Prioridad |
|---|---|---|
| M-1 | `PlanMission`: base → (rover) → staging → (EVA, 3 perfiles) → staging → (rover) → base; feasibility global | MUST |
| M-2 | Timeline por sol (§0.2): bloques `drive_out / overnight / eva / drive_back` con hora LTST, respetando ventana EVA y luz | MUST |
| M-3 | `assumptions` agregadas de ambos tramos en la respuesta | MUST |

### R — Tramo rover (SEV presurizado, grilla regional)
| ID | Funcionalidad | Prioridad |
|---|---|---|
| R-1 | Costo de arista del rover: energía eléctrica (kWh) por pendiente direccional y rodadura; máscara con `classes_rover` | MUST |
| R-2 | A\* regional (10 m/celda) base → staging y regreso; métricas: distancia, ascenso, pendiente máx., kWh, % batería, tiempo | MUST |
| R-3 | Campo de *drive-back* (Dijkstra desde la base) → reserva de batería a lo largo del traslado | SHOULD |
| R-4 | Elegir el staging automáticamente: celda transitable para el SEV que minimice la caminata a los objetivos elegidos (por defecto, T01) | COULD |

### P — Rutas EVA (grilla local)
| ID | Funcionalidad | Prioridad |
|---|---|---|
| P-1 | Costo de arista direccional: energía (Pandolf) × riesgo × descuento por ciencia | MUST |
| P-2 | A\* en grilla de 8 vecinos con máscara no transitable dilatada | MUST |
| P-3 | Tres perfiles `safe`, `fast`, `scientific` → 3 rutas comparables | MUST |
| P-4 | Waypoints: staging → T_i → … → T_n → staging | MUST |
| P-5 | Métricas por ruta y por tramo: distancia, ascenso, pendiente máx., energía, O₂, tiempo, dosis, ciencia | MUST |
| P-6 | Costo de paradas: `eva_sampling.duration_min` × tasa metabólica de parada | MUST |
| P-7 | Suavizado por línea de vista | SHOULD |
| P-8 | Validación: Dijkstra (h = 0) = A\* en costo | MUST (test) |

### S — Seguridad y ejecución
| ID | Funcionalidad | Prioridad |
|---|---|---|
| S-1 | Campo de retorno EVA: Dijkstra **desde el SEV (staging)** en el grafo invertido → O₂ para volver desde cualquier celda | MUST |
| S-2 | Punto de no retorno (PNR) en la ruta | MUST |
| S-3 | Simulación de la caminata (posición, progreso, O₂, reserva, dosis) | MUST |
| S-4 | Reglas de alerta en 3 niveles (info / caution / rtb) | MUST |
| S-5 | Escenarios de contingencia (≥ 2 para la demo: `sep_event`, `suit_leak`) | SHOULD |
| S-6 | Replanificación desde la posición actual | SHOULD |
| S-7 | Isolínea "zona segura" para el mapa | SHOULD |
| S-8 | *Rideback*: ruta del SEV hacia la tripulación (grafo rover) si `injury` | COULD |

**Mínimo para la demo:** P-1…P-6, S-1, S-2, S-4, R-1, R-2, M-1, M-2 (perfil único en el rover).

---

## 4. Contratos de entrada/salida

### 4.0 Convenciones globales (no negociables)
- **Indexación interna:** `(fila, col)`, origen arriba a la izquierda; la fila crece hacia el sur y la columna hacia el este. Las rutas viajan **dentro del backend** como listas de celdas.
- **Hacia el frontend:** coordenadas `[lon, lat]` (orden GeoJSON, como `LonLat` en `frontend/src/shared/types/geo.ts`). Las celdas se incluyen solo para depurar.
- **Unidades SI:** m, s, kJ, kWh, L de O₂, mSv. Pendiente en grados (en Pandolf se usa `G` en %).
- **Arrays:** `.npy` con `shape = (rows, cols)` idéntica a `grid.json`. `float32` para valores continuos, `uint8` para clases.
- **NoData:** `NaN` en `dem.npy`; `255` en las clases, y se trata como no transitable.
- **Escalas:** `scale ∈ {"local", "regional"}`. Cada una tiene su `grid.json`. Nada se mezcla entre escalas; el puente es `lon/lat` vía `GridSpec`.
- **Conversión geográfica:** solo en `domain/models/grid.py`. **Radio:** `GridSpec` usa el `R` del proj4 de `grid.json`, la esfera de 3 396 190 m de los productos USGS/MOLA. `geo.py` usa el radio medio de 3 389 500 m para haversine; la diferencia es del 0.2 % y se acepta solo para distancias de visualización.
- **Perfiles:** `safe | fast | scientific` (como `RouteProfile` en `domain/models/route.py`).
- **API:** prefijo `/api/v1`. Campos en `snake_case`.

### 4.1 Quién entrega qué (intercambio entre integrantes)

| # | Artefacto | De → a | Formato / ruta | Mock disponible | Para |
|---|---|---|---|---|---|
| 1 | Grilla sintética + respuestas ejemplo | Mec. B → Full stack | `tests/fixtures/synthetic_grid()`, `tests/fixtures/*.json` | — | Sáb 18:00 |
| 2 | DTOs de ruta/misión/simulación | Mec. B → Full stack | `schemas.py` + espejo en `features/*/types.ts` | ejemplos JSON §4.4 | Sáb 18:00 |
| 3 | Terreno local (boxwork) | Mec. A → Mec. B | `data/terrain/local/*` (§4.2) | sintético | Sáb 19:00 |
| 4 | Terreno regional (corredor) | Mec. A → Mec. B | `data/terrain/regional/*` | sintético (rampa + zona de arena) | Sáb 21:00 |
| 5 | Objetivos | Estudiante → Mec. B / Full stack | `data/targets_v0.geojson` ✅ | — | listo |
| 6 | Ambiente, radiación, fisiología | Estudiante → Mec. B | `data/env.json` ✅ | — | listo |
| 7 | Bases del globo + base Calef | Estudiante → Full stack / Mec. B | `data/sites.geojson` 🆕 | base fija en `mission_params.json` | Dom 09:00 |
| 8 | Parámetros SEV y políticas EVA | Mec. B → todos | `data/mission_params.json` 🆕 | — | Sáb 18:00 |
| 9 | Respaldo de la demo | Mec. B → Full stack | `frontend/public/data/fallback_mission.json`, `fallback_simulation.json` | — | Dom 14:00 |
| 10 | Capas PNG (pendiente, riesgo, zona segura) | Mec. A / Mec. B → Full stack | `frontend/public/data/layers/*.png` + bbox | — | Dom 13:00 |

**Mock primero:** todo endpoint existe primero con datos sintéticos. Pasar a datos reales **no cambia la forma de la respuesta**.

### 4.2 Mec. A → Mec. B (terreno)
**`data/terrain/<scale>/grid.json`**
```json
{
  "scale": "local",
  "crs_proj4": "+proj=eqc +lat_ts=0 +lon_0=0 +R=3396190 +units=m +no_defs",
  "origin_xy": [x0, y0],
  "cell_size_m": 2.0,
  "shape": [1000, 1000],
  "bbox_lonlat": [137.37204, -4.8126, 137.40596, -4.7788],
  "sources": [{"name": "MSL Gale Merged DEM 1m", "mission": "MRO HiRISE + CTX, MGS MOLA", "resolution_m": 1, "url": "..."}]
}
```
- **local:** bbox del boxwork (`env.json → site.bbox_lon_lat`), 1–2 m/celda.
- **regional:** corredor que contiene la base (137.42009295, −4.59310427) y el bbox local. Por ejemplo `[137.36, -4.82, 137.43, -4.58]` (~4 × 14 km; a 10 m → ~410 × 1 420 ≈ 0.6 M celdas). Mec. A confirma la cobertura del DEM merged de 1 m en la elipse; si no cubre, usa DTM CTX (~20 m) o HRSC.

| Archivo | dtype | Contenido |
|---|---|---|
| `dem.npy` | float32 | Elevación (m, areoide MOLA), mediana 3×3, `NaN` = sin datos |
| `classes_human.npy` (local) | uint8 | 0 transitable (< 10°), 1 precaución (10–20°), 2 no transitable (> 20°, roca o duna), 255 sin datos. Umbrales de `env.json → terrain_classes` |
| `classes_rover.npy` (regional) | uint8 | 0 nominal (< 15°), 1 precaución (15–25°), 2 no transitable (> 25°, campos de *ripples*/dunas, bloques), 255 sin datos. Umbrales en `mission_params.json → rover.slope_classes` (**supuesto**, §5.0) |
| `risk.npy` | float32 [0,1] | Riesgo continuo: pendiente normalizada + rugosidad TRI + penalización de arena |
| `confidence.npy` | float32 [0,1] | 1 = DTM nativo, 0 = interpolado o sin datos |

Yo derivo la **pendiente direccional** entre celdas desde `dem.npy`, porque subir y bajar no cuestan lo mismo.

**Entrega v1.0 de Mec. A** (rama `feat/terrain-geospatial-data`, detalle en [`terrain-data.md`](terrain-data.md)):

| Grilla | Resolución | Tamaño | Cubre |
|---|---|---|---|
| Local | 1 m | 2005 × 2011 | Boxwork |
| Regional | 10 m | 1424 × 416 | `[137.360, −4.820, 137.430, −4.580]` |

- Ambas vienen del MSL Gale Merged DEM de 1 m, con 100 % de cobertura.
- Cumplen este contrato sin cambios y se cargan con `kind: "measured"`.
- La base queda dentro de la regional, a −4 497.8 m, en una celda de clase 0.
- **Limitaciones de v1.0:**
  - `risk` es solo pendiente (sin TRI ni arena);
  - `confidence` es solo 0/1, así que `LOW_CONFIDENCE` no se dispara;
  - la regional no cubre todavía la EZ de ≥100 km.
- `adapters/outbound/terrain/synthetic.py` queda solo como respaldo si faltan los `.npy`.

### 4.3 Estudiante → Mec. B (esquema real de los archivos)
**`targets_v0.geojson`** — `FeatureCollection` de `Point [lon, lat]`. Campos que uso:

| Campo | Uso en mis módulos |
|---|---|
| `id`, `name` | waypoints, `next_wp` en la simulación |
| `rubric.{novelty,habitability,human_only}`, `rubric.total_15` | `science_score` = suma de `total_15` de los visitados |
| `S` (0–1, = total_15/15) | rasterizo `science.npy` (radio de influencia 15 m, **supuesto**) |
| `eva_sampling.duration_min`, `eva_sampling.tool` | paradas (P-6): tiempo de tarea |
| `elev_geoid_m` | chequeo cruzado contra `dem.npy` (alerta si difiere > 5 m) |
| `shielding_reduction_pct` | reducción de dosis durante la parada |
| `is_base: true` (T01) | **staging del SEV** (punto de inicio y fin de la EVA). La base/hábitat ya **no** es T01; está en `sites.geojson` |
| `is_shelter: true` (T08) | refugio alternativo en `sep_event` si el SEV está más lejos |
| `paired_with` | se sugiere visitar juntos (T05/T06) |

**`env.json`** — bloques que uso:

| Ruta | Uso |
|---|---|
| `radiation.gcr_dose_mSv_per_sol` (0.64, medido, RAD) | dosis EVA = tasa × t / 88 775 s |
| `radiation.solar_storm.unshielded_dose_rate_mSv_per_hr` (modelado) | escenario `sep_event` |
| `radiation.limits.eva_nominal_budget_mSv` (supuesto) | alerta `DOSE_HIGH` |
| `eva_window.{start,end,max_duration_min}` | M-2 y alerta `WINDOW_END` |
| `time.{sol,sunrise,sunset}` | M-2 (manejo solo con luz) |
| `dust.{optical_depth_tau,dust_storm_speed_factor}` | escenario `dust_storm` |
| `physiology.*` (modelado/supuesto) | parámetros EVA (§4.5), hasta migrarlos a `mission_params.json` |
| `reference_eva.profiles.*.w_risk` | pesos por perfil (§5.1) |
| `communications.orbital_relays` | (COULD) alerta de pérdida de enlace fuera de ventana |

**`sites.geojson` 🆕** (Estudiante): `Point` por base o EZ con `{"id", "name", "kind": "ez_2015|base", "interactive": bool, "source", "source_url"}`. Gale: `{"id": "gale_calef2015", "coordinates": [137.42009295, -4.59310427], "interactive": true, "source": "Calef et al. 2015, abstract #1020"}`.

### 4.4 Mec. B → Full stack (API)
Los DTOs viven en `adapters/inbound/http/schemas.py`. El frontend los espeja en `features/route-planning/types.ts` y `features/field-simulation/types.ts` (regla de CONTRIBUTING §7).

**`POST /api/v1/mission/plan`** — la llamada principal de la demo.
```json
// Request
{"base": [137.42009295, -4.59310427],  // opcional; por defecto la base Calef
 "staging_target_id": "T01",           // opcional; null → R-4
 "target_ids": ["T02", "T05", "T06"],
 "profiles": ["safe", "fast", "scientific"],
 "departure": {"sol": 5074, "ltst": "06:00"},
 "scenario": "none"}
// Response
{"base": {"lonlat": [137.42009295, -4.59310427]},
 "staging": {"target_id": "T01", "lonlat": [137.396, -4.785]},
 "traverse_out":  {"path": [[lon, lat]], "metrics": {"dist_m": 0, "ascent_m": 0, "max_slope_deg": 0,
                   "energy_kWh": 0, "battery_used_pct": 0, "time_min": 0, "feasible": true}},
 "eva": {"routes": [ /* RouteOut, ver /routes */ ]},
 "traverse_back": { /* igual que traverse_out */ },
 "timeline": [{"sol": 5074, "start": "06:00", "end": "09:40", "activity": "drive_out"},
              {"sol": 5074, "start": "09:40", "end": "24:00", "activity": "overnight"},
              {"sol": 5075, "start": "09:30", "end": "14:10", "activity": "eva", "profile": "safe"}],
 "feasible": true,
 "warnings": [{"code": "NIGHT_DRIVE_AVOIDED", "msg": "..."}],
 "assumptions": {"rover.mass_kg": {"value": 4000, "kind": "supuesto"}, "...": "..."}}
```

**`POST /api/v1/routes`** — solo la EVA (reemplaza el 501 actual).
```json
// Request
{"start_target_id": "T01", "target_ids": ["T02", "T05"], "end_target_id": "T01",
 "profiles": ["safe", "fast", "scientific"]}
// Response
{"routes": [{
   "profile": "safe",
   "path": [[lon, lat]], "cells": [[r, c]],
   "metrics": {"dist_m": 0, "ascent_m": 0, "max_slope_deg": 0, "energy_kJ": 0, "o2_L": 0,
               "time_min": 0, "dose_mSv": 0, "science_score": 0, "o2_margin_at_end": 0.0, "feasible": true},
   "segments": [{"from": "T01", "to": "T02", "dist_m": 0, "energy_kJ": 0, "time_min": 0, "o2_L": 0}],
   "stops": [{"target_id": "T02", "path_index": 140, "task_min": 30, "energy_kJ": 0}],
   "elevation_profile": [{"d_m": 0, "z_m": 0}],
   "pnr_index": null
 }],
 "assumptions": {}}
```

**`POST /api/v1/traverse`** — solo el rover: `{"from": [lon, lat], "to": [lon, lat] | "T01"}` → `{"path", "metrics", "assumptions"}`, con los mismos `metrics` que `traverse_out`.

**`GET /api/v1/return-field?leg=eva|rover&scenario=none`** → `{"png_url": "/data/layers/return_o2.png", "bbox_lonlat": [...], "max_value": 0, "unit": "L|kWh", "safe_mask_png": "..."}`. Se precalcula al iniciar (lifespan) y se cachea por `(leg, scenario)`.

**`POST /api/v1/simulate`**
```json
// Request
{"profile": "safe", "route": { /* RouteOut devuelto por /routes */ },
 "scenario": "none|dust_storm|sep_event|suit_leak|injury|blocked_path", "scenario_at_index": 80}
// Response: timeline muestreada (≤ 500 filas)
{"timeline": [{"t_min": 0, "lonlat": [lon, lat], "progress": 0.0, "o2_left_L": 0, "return_o2_L": 0,
               "reserve_L": 0, "dose_mSv": 0, "next_wp": "T02", "dist_left_m": 0,
               "alert": {"level": "info|caution|rtb", "code": "RESERVE_LOW", "msg": "..."} }],
 "replanned_route": null,
 "rideback": null}
```

**`GET /api/v1/scenarios`** → `[{"id": "sep_event", "label": "...", "effect": "...", "kind": "supuesto"}]`.

**Cambios de contrato:** los campos nuevos son **opcionales**. Si se renombra o elimina algo, es *breaking* y se marca con `!` en el commit (`feat(backend)!: ...`), actualizando `schemas.py` + `types.ts` + este documento en el mismo PR.

### 4.5 Parámetros (`data/mission_params.json`, mío)
```json
{
  "base": {"lonlat": [137.42009295, -4.59310427], "source": "Calef et al. 2015 (presentación, nasa.gov)", "kind": "medido"},
  "eva": {"from_env_json": "physiology", "stop_rate_W": 220, "science_radius_m": 15,
          "reserve_caution_fraction": 0.20, "kind": "supuesto"},
  "rover": {
    "name": "NASA SEV (pressurized)", "crew": 2, "cabin_days": 14, "v_max_kmh": 10,
    "v_nominal_kmh": 5, "v_caution_kmh": 3,
    "mass_kg": 4000, "crr": 0.15, "drivetrain_eff": 0.8, "hotel_kW": 1.5,
    "battery_kWh": 100, "battery_reserve_fraction": 0.30, "cabin_dose_factor": 0.5,
    "slope_classes": {"nominal_max_deg": 15, "caution_max_deg": 25},
    "no_night_drive": true,
    "kind": {"crew,cabin_days,v_max_kmh": "medido (NASA SEV)", "resto": "supuesto"}
  }
}
```


### 4.6 Flujo de integración: qué recibo, cómo lo uso y qué entrego

```
  Mec. A (terreno)                    Estudiante (datos NASA)
  data/terrain/{local,regional}/      data/targets_v0.geojson · env.json · sites.geojson
  grid.json + *.npy                            │
        │                                      │
        ▼  npy_terrain.py (adapter)            ▼  json_targets.py / json_environment.py / json_params.py
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ MEC. B — domain/ + application/                                              │
  │  GridSpec (lon/lat ↔ celda) → costos (metabolic.py, rover_energy.py)         │
  │  → A* (pathfinding.py) → métricas → campo de retorno → PNR/alertas → timeline │
  │  Casos de uso: PlanMission · PlanRoutes · PlanTraverse · SimulateEva ·        │
  │                GetReturnField                                                 │
  └──────────────────────────────────────────────────────────────────────────────┘
        │  DTOs (schemas.py) — siempre [lon, lat] hacia afuera
        ▼
  Full stack: routers /api/v1/... → frontend
     features/map · features/route-planning · features/field-simulation
```

**Lo que recibo de Mec. A (terreno) y cómo lo uso**

| Recibo | Lo convierto en / lo uso para | Dónde |
|---|---|---|
| `grid.json` (`origin_xy`, `cell_size_m`, `shape`, `crs_proj4`) | Construir `GridSpec`: pasar los `[lon, lat]` de base, objetivos y clics de la UI a `(fila, col)`, y devolver las rutas como `[lon, lat]` | `domain/models/grid.py` |
| `dem.npy` | Pendiente **direccional** `G` de cada arista → Pandolf (EVA, kJ) y `sinθ` (rover, kWh); `ascent_m`, `max_slope_deg`, `elevation_profile` | `metabolic.py`, `rover_energy.py` |
| `classes_human.npy` / `classes_rover.npy` | Máscara no-go (clase 2/255, dilatada) → arista `inf` en A\*; clase 1 → velocidad reducida y alerta `SLOPE_AHEAD` | `pathfinding.py`, `safety_rules.py` |
| `risk.npy` | Factor `(1 + w_r·risk)` del costo de búsqueda: hace que `safe` se aleje de `fast` | costo de búsqueda |
| `confidence.npy` | Alerta `LOW_CONFIDENCE`; se muestra en la UI como "dato interpolado" | `safety_rules.py` |

**Lo que recibo del Estudiante (datos NASA) y cómo lo uso**

| Recibo | Campo | Lo uso para |
|---|---|---|
| `targets_v0.geojson` | `geometry.coordinates` | Waypoints de la EVA (→ celda vía `GridSpec`) |
| | `rubric.total_15`, `S` | `science_score` de cada ruta; capa `science.npy` (descuento del perfil `scientific`) |
| | `eva_sampling.duration_min` | Duración de cada parada → energía y O₂ de la parada |
| | `is_base` (T01) / `is_shelter` (T08) | Staging del SEV (inicio/fin de la EVA y fuente del campo de retorno) / refugio en `sep_event` |
| | `shielding_reduction_pct` | Menor dosis durante la parada |
| `env.json` | `radiation.gcr_dose_mSv_per_sol`, `radiation.limits` | `dose_mSv` y alerta `DOSE_HIGH` |
| | `eva_window`, `time.sunrise/sunset` | Timeline por sol (M-2): cuándo puede haber EVA y cuándo se puede manejar |
| | `physiology.*` | Parámetros de Pandolf, capacidad de O₂, márgenes, multiplicadores de escenarios |
| | `reference_eva.profiles.*.w_risk` | Pesos de los perfiles |
| | `dust`, `radiation.solar_storm` | Escenarios `dust_storm` y `sep_event` |
| `sites.geojson` 🆕 | punto `gale_calef2015` | Origen del tramo rover (la base) |

**Lo que entrego y cómo se integra**

| Entrego | Lo consume | Cómo se integra en la UI |
|---|---|---|
| `POST /api/v1/mission/plan` → `traverse_out/back.path` | Full stack, `features/map` | Línea del rover base → T01 sobre el mapa regional |
| `eva.routes[].path` (3 perfiles) | `features/map` | 3 líneas de colores sobre el boxwork |
| `metrics`, `segments`, `stops`, `elevation_profile` | `features/route-planning` | Comparador de 3 rutas (O₂, tiempo, dosis, ciencia, factibilidad) y perfil de elevación |
| `timeline` (por sol) | `features/route-planning` | Cronograma Sol N / N+1 / N+2 |
| `pnr_index` | `features/map` | Marcador "punto de no retorno" sobre la ruta |
| `GET /return-field` → PNG + `bbox_lonlat` | `features/map` | Capa ráster "zona segura" e isolínea |
| `POST /simulate` → `timeline[]` con `alert` | `features/field-simulation` | HUD (O₂, reserva, dosis, próximo waypoint) y modal de alertas |
| `assumptions` (con `kind`) | todas las features | Panel "supuestos y fuentes" (honestidad del dato) |
| `fallback_mission.json`, `fallback_simulation.json` | Full stack | Respaldo si el backend no responde en la demo |
| DTOs en `schemas.py` | Full stack | Los espeja en `features/*/types.ts` |

**Ejemplo de punta a punta:** el usuario elige T02, T05 y T06 y pulsa "Planificar".
1. El frontend envía `POST /api/v1/mission/plan` con `target_ids` y `departure`.
2. `PlanMission` lee la base (`sites.geojson`), T01 y los objetivos (`targets_v0.geojson`) y la ventana EVA (`env.json`).
3. `PlanTraverse` corre A\* en la grilla **regional** de Mec. A con el costo del rover → `traverse_out`.
4. `PlanRoutes` corre A\* en la grilla **local** con Pandolf para cada perfil → `eva.routes`. Con el campo de retorno desde T01 calcula la reserva y el PNR.
5. `PlanMission` arma la `timeline` por sol y junta `assumptions`.
6. El Full stack dibuja las rutas en el mapa, el comparador y el cronograma. Si el usuario pulsa "Ejecutar", llama a `POST /simulate` con la ruta elegida.

---

## 5. Parámetros seguros: vehículo vs humano

La lógica es la misma (grafo + costo + reserva de retorno), pero los **límites, el recurso que se agota y los peligros cambian**.

| Aspecto | EVA a pie (traje + PLSS) | Rover presurizado (SEV) | Tipo / fuente |
|---|---|---|---|
| Pendiente nominal / precaución / no-go | < 10° / 10–20° / > 20° | < 15° / 15–25° / > 25° | Humano: `env.json → terrain_classes` (supuesto, **a verificar** contra NASA EVA/Constellation). Rover: supuesto; referencia LRV de Apolo: diseño para subir 25° cargado (NASA TM X-64623, **a verificar**) |
| Obstáculo | DEM detecta ≥ 2 m (`site.min_detectable_obstacle_m`); el humano rodea a escala sub-métrica | LRV: escalón ~30–35 cm (**a verificar**); obstáculos < 2 m **no se ven en el DEM** → `confidence` y `risk` (TRI) lo compensan | medido (DEM) / a verificar |
| Velocidad | 0.75 m/s nominal (`physiology.nominal_walking_speed_m_s`), × 0.6 en precaución | ≤ 10 km/h máx. (NASA SEV); 5 km/h nominal, 3 km/h en precaución | medido (SEV máx.) / supuesto |
| Recurso que se agota | O₂ del PLSS: 300 L (`plss_o2_capacity_L`); además CO₂ (850 g) y agua de enfriamiento (4.2 L) | Batería (kWh). Cabina: 14 días, no limita la demo | modelado/supuesto (`env.json`) / medido (14 días) / supuesto (kWh) |
| Unidad de costo | kJ metabólicos (Pandolf a 0.38 g × traje 1.25) → L de O₂ (20.1 kJ/L) | kWh = rodadura + pendiente + carga hotel | modelado |
| Margen de retorno | × 1.3 (`return_safety_factor`); precaución si reserva < 20 % | 30 % de batería reservada para el *drive-back* | supuesto |
| Refugio | **SEV estacionado** (staging); alternativo T08 (`is_shelter`) en SEP | **Base/hábitat** | diseño |
| Radiación | GCR 0.64 mSv/sol sin blindaje (RAD, medido); paradas con `shielding_reduction_pct`; presupuesto EVA 0.15 mSv (supuesto, NASA-STD-3001) | Cabina con factor de blindaje 0.5 (**supuesto**); en SEP la cabina es el refugio | medido / supuesto |
| Peligros propios | Arena (η = 2.0, Pandolf), fatiga, frío (ventana > −40 °C), caída en pendiente | **Arena/ripples** (Spirit quedó atrapado en 2009; Curiosity evitó Hidden Valley en 2014), **rocas afiladas** (daño en ruedas de Curiosity, 2013–14), vuelco lateral | histórico NASA/JPL (**a verificar** la cita exacta) |
| Duración máxima | ventana EVA de 360 min (`eva_window`) | solo con luz del día (05:48–17:52) | modelado / supuesto |
| Comunicaciones | relés orbitales (`communications.orbital_relays`) + enlace con el SEV | antena del SEV | modelado |

**Consecuencias para el planificador**
- El rover puede tomar pendientes que la EVA no puede, pero **arena y campos de *ripples* son no-go para el rover**, mientras que para el humano solo encarecen la caminata (η = 2.0). Por eso se necesitan dos juegos de clases.
- La reserva de la EVA **se mide contra el SEV**: S-1 corre Dijkstra desde la celda del staging en la grilla local. La reserva del rover se mide contra la base: R-3 corre en la grilla regional.
- En `sep_event`, la regla `rtb` lleva al refugio más barato en O₂ (SEV o T08).

---

## 6. Algoritmos

### 6.1 Costo de arista EVA (P-1) — `domain/services/metabolic.py`
Para pasar de la celda `i` a la vecina `j` (8 vecinos; `d = cell` o `cell·√2`):
1. `Δz = dem[j] − dem[i]`; `G = 100·Δz/d` (%, direccional).
2. Si `classes_human[j] ∈ {2, 255}` o la celda está en la máscara dilatada → arista inválida (`math.inf`, como espera `astar`).
3. `V = v_nominal · (0.6 si classes_human[j] == 1, si no 1.0)`.
4. **Pandolf** (Pandolf, Givoni & Goldman 1977), escalado a la gravedad marciana y al traje:
   `M = suit · [1.5·W + g_ratio·( 2.0·(W+L)·(L/W)² + η·(W+L)·(1.5·V² + 0.35·V·G⁺) )]` [W]
   con `G⁺ = max(G, 0)`. En bajada se usa el costo de terreno plano (conservador).
   > ⚠️ **Discrepancia con el código actual:** hoy `physics.pandolf_watts` multiplica **todo** `M`, incluido el metabolismo basal `1.5·W`, por `g_ratio`. El basal no depende de la gravedad, así que se corrige a la fórmula de arriba y se fija con un test (`test_basal_not_scaled_by_gravity`). `g_ratio` = 3.721/9.80665 = 0.3794 (en `env.json` figura redondeado a 0.38).
5. `E_ij = M·(d/V)/1000` [kJ]; `t_ij = d/V` [s].
6. Costo de búsqueda: `c_ij = E_ij·(1 + w_r·risk[j])·(1 − w_s·science[j])`, con `w_s ≤ 0.5` para que `c > 0`.

| Perfil | `w_r` | `w_s` | Fuente |
|---|---|---|---|
| `safe` | 3.5 | 0.1 | `env.json → reference_eva.profiles.safe.w_risk` |
| `fast` | 0.0 | 0.0 | ídem |
| `scientific` | 1.0 | 0.5 | ídem (`w_s` en `mission_params.json`) |

### 6.2 Costo de arista del rover (R-1) — `domain/services/rover_energy.py`
- `θ = atan(Δz/d)`; si `classes_rover[j] ∈ {2, 255}` → arista inválida.
- `v = v_nominal` o `v_caution` según la clase.
- `E_ij = [ m·g_M·(Crr·cosθ + sinθ)·d / η_dt ]⁺ + P_hotel·(d/v)` → kWh (÷ 3.6e6). En bajada el término de tracción se acota en 0 (sin regeneración, conservador).
- Costo de búsqueda: `E_ij·(1 + w_r·risk[j])`, un solo perfil (`w_r` = 1.0, supuesto).
- Métricas: `dist_m`, `ascent_m`, `max_slope_deg`, `energy_kWh`, `battery_used_pct`, `time_min`. `feasible = E_ida + E_vuelta ≤ battery·(1 − reserve)`.

### 6.3 A\* (P-2, P-3, P-4, R-2) — `domain/services/pathfinding.py`
- Se **reutiliza** `astar(rows, cols, start, goal, step_cost, heuristic)` (ya probado contra Dijkstra en `tests/unit/test_pathfinding.py`). Para 1 000 × 1 000 celdas se cambian los `dict` internos por arrays numpy (`g`, `parent`) **sin cambiar la firma**.
- Heurística admisible: `dist_euclídea · costo_mínimo_por_m` (EVA: energía en plano a `V` máx. con η mínimo y `(1 − w_s_max)`; rover: `m·g_M·Crr/η + P_hotel/v_max`). Cualquier factor que pueda bajar el costo debe entrar en la heurística.
- Máscara: `scipy.ndimage.binary_dilation(classes == 2, iterations=1..2)`.
- Waypoints: A\* por tramos y concatenación sin duplicar la celda de unión.
- Rendimiento: si pasa de 5 s → planificar a 4 m/celda en local o usar `numba`. La grilla regional a 10 m (~0.6 M celdas) se puede bajar a 20 m (~150 k) si hace falta.
- **Submuestreo** (`terrain_analysis.downsample`, se activa cuando hay más de `SENDA_MAX_PLANNING_CELLS` = 300 k celdas). Con los datos v1.0, el local pasa de 1 m a 4 m y la regional de 10 m a 20 m.
  - Se conservan del bloque: DEM = media, confianza = mínima.
  - La clase se **reclasifica por pendiente sobre el DEM agregado**, con los umbrales de la escala. El riesgo es la media del bloque.
  - No se usa "la peor clase del bloque": con el DEM de 1 m, la rugosidad métrica de las crestas del boxwork (29 % > 20°) subía el no-go al 65 % y aislaba T04–T07. Con la reclasificación queda en 35 % y los 8 objetivos quedan conectados.

### 6.4 Métricas y consumibles EVA (P-5, P-6) — `metabolic.py`
- Se suma `E_ij` **real** (sin pesos), `t_ij`, ascenso y pendiente máx.
- Paradas: `E_stop = stop_rate_W · duration_min · 60 / 1000`.
- `O2 = E / 20.1`; `dose = 0.64 · t_total / 88 775 s · (1 − shielding en paradas)`.
- `science_score = Σ rubric.total_15` de los objetivos visitados.
- `feasible = O2_ruta ≤ plss_o2_capacity_L` **y** en ningún punto `reserve < 0` (§6.5) **y** `time ≤ eva_window.max_duration_min`.

### 6.5 Campo de retorno, PNR y alertas (S-1, S-2, S-4, S-7, R-3)
- `dijkstra_field(source, step_cost)`: Dijkstra multi-destino desde `source` sobre el **grafo invertido**. Para relajar `u → v` se usa el costo de `v → u`. Peso = energía **real**.
  - EVA: `source = celda del staging (SEV)` → `return_O2.npy` (L).
  - Rover: `source = celda de la base` → `return_kWh.npy`.
- `reserve(k) = O2_left(k) − return_O2[cell_k]·return_safety_factor`. `pnr_index` = primer `k` con `reserve < 0`.
- `safe_mask` (S-7): celdas con `return_O2·1.3 ≤ capacidad`, saliendo con tanque lleno.

| Código | Condición | Nivel |
|---|---|---|
| `RESERVE_LOW` | `reserve < caution_margin_threshold · capacidad` (0.20) | caution |
| `PNR_REACHED` | `reserve ≤ 0` | **rtb** |
| `SEP_EVENT` | escenario `sep_event` activo → ir al refugio más barato (SEV o T08) | **rtb** |
| `WINDOW_END` | `t ≥ eva_window.end − tiempo_retorno` | caution → rtb |
| `SLOPE_AHEAD` | próxima celda clase 1 dentro de 20 m | info |
| `LOW_CONFIDENCE` | `confidence < 0.5` | info |
| `DOSE_HIGH` | dosis EVA > `eva_nominal_budget_mSv` | caution |

### 6.6 Simulación y escenarios (S-3, S-5, S-6, S-8)
| Escenario | Efecto | Parámetro |
|---|---|---|
| `dust_storm` | `V × dust_storm_speed_factor` (0.70); `risk × 1.5`; rover sin cambios en la demo | `env.json → dust` |
| `sep_event` | dosis × `unshielded_dose_rate` durante el evento; alerta rtb al refugio | `env.json → radiation.solar_storm` |
| `suit_leak` | consumo de O₂ × `suit_leak_multiplier` (1.5) | `env.json → physiology` |
| `injury` | `V × injury_speed_multiplier` (0.5) → recalcular reserva; S-8: ruta del SEV hacia la tripulación | ídem |
| `blocked_path` | celdas → clase 2 → replanificar desde la posición actual (S-6) | UI |

---

## 7. Datos y fuentes (NASA e instituciones asociadas)

| Dato | Misión / fuente | Lo provee | Uso | Tipo |
|---|---|---|---|---|
| Base/hábitat **137.42009295°E, 4.59310427°S** (coordenada del equipo, tomada de la presentación de Calef 2015). *Procedencia:* el texto del abstract #1020 da 137.4019°E, −4.5965° como "centro de la elipse final de MSL", ~1.1 km de diferencia; **manda la del equipo**. EZ de 100 y 25 km, ROIs ISRU, *camps* en cráteres de ~100 m | Calef III et al. 2015, *Assessing Gale Crater as a Landing Site for the First Human Mission to Mars*, abstract #1020 — [abstract](https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1020.pdf), [presentación](https://www.nasa.gov/wp-content/uploads/2015/11/calef_galecrater_lsez2015tagged.pdf) | Estudiante | Origen de la misión (vista 2) | medido / propuesta |
| EZ del taller 2015 (47 propuestas) | NASA First Landing Site/EZ Workshop — [anuncio](https://www.nasa.gov/sites/default/files/atoms/files/first-landing-site-announcement.pdf) | Estudiante | Globo (vista 1) | propuesta |
| DEM 1 m + orto 25 cm | USGS *MSL Gale Merged DEM / Orthophoto* (Calef & Parker; MRO HiRISE + CTX, MGS MOLA) | Mec. A | Pendiente, costo, clases (local y regional) | medido |
| Vehículo presurizado | NASA SEV — [science.nasa.gov/3d-resources/space-exploration-vehicle](https://science.nasa.gov/3d-resources/space-exploration-vehicle/): 2 tripulantes, 14 días, ~10 km/h, 12 ruedas que giran 360° | Mec. B | `rover.*` medidos | medido (spec) |
| Arquitectura Mars humana | *Human Exploration of Mars DRA 5.0*, NASA-SP-2009-566 (citada por Calef 2015) | Mec. B | Contexto: rovers presurizados, EZ | referencia (**a verificar** los números) |
| Walkback | Norcross et al., *EVA Walkback Test*, NASA/TP-2009-214796 (10 km con traje) | Mec. B | Justificación del SEV (§0.4) | referencia |
| Referencia de rover | Apollo LRV Operations Handbook — [ALSJ](https://www.nasa.gov/wp-content/uploads/static/history/alsj/lrv_opsnas8-25145.pdf); NASA TM X-64623 (25°, obstáculo de 30 cm) | Mec. B | Umbrales supuestos del rover | **a verificar** |
| Objetivos boxwork (T01–T08), geoquímica | MSL Curiosity: MMGIS `MSL_waypoints.json`, APXS/ChemCam/CheMin (PDS), *mission updates* sols 4414–4711 | Estudiante | Waypoints, paradas, `science_score` | medido |
| Dosis GCR en superficie | MSL **RAD** — Hassler et al. 2014, *Science* 343 | Estudiante | Dosis EVA | medido |
| Evento solar | **DONKI** (NASA CCMC) + modelado RAD SEP | Estudiante | `sep_event` | modelado |
| Temperatura, presión, viento | MSL **REMS** | Estudiante | Ventana EVA | medido |
| Opacidad de polvo | Mastcam τ, MRO MARCI | Estudiante | `dust_storm` | medido |
| Metabolismo de marcha | Pandolf, Givoni & Goldman 1977, *J. Appl. Physiol.* 43(4) | Mec. B | Costo EVA | modelo |
| Estándar humano | NASA-STD-3001 (límites de dosis, EVA) | Estudiante | Presupuestos y límites | referencia |
| Validación | Traverse real de Curiosity (MMGIS) | Estudiante | Comparar la ruta `safe` del rover con el camino que eligió Curiosity en el corredor | medido |

> Regla: ninguna cifra entra al código sin `source` y `kind`. Las marcadas **a verificar** se muestran en la UI como supuestos hasta confirmarlas.

---

## 8. Pruebas mínimas (`backend/tests/unit/`)
1. `test_astar_equals_dijkstra` ✅ (ya existe) + versión con costo Pandolf en la grilla sintética.
2. `test_route_avoids_nogo`: ninguna celda de la ruta es clase 2/255 ni está en la máscara dilatada (EVA y rover).
3. `test_uphill_costs_more`: `E(i→j) > E(j→i)` si `dem[j] > dem[i]` (EVA y rover).
4. `test_basal_not_scaled_by_gravity`: con `V = 0`, `M = suit·1.5·W`.
5. `test_return_field_zero_at_source` y finitud cuando hay camino.
6. `test_pnr_detected`: con O₂ pequeño, `pnr_index` existe y está antes del final.
7. `test_profiles_differ`: `safe` ≠ `fast` en la grilla sintética.
8. `test_rover_crosses_slope_human_cannot`: una rampa de 18° es transitable para el rover y no-go para la EVA.
9. `test_timeline_respects_eva_window`: ninguna actividad `eva` cae fuera de 09:30–15:30 y ningún `drive_*` ocurre de noche.
10. Integración: `POST /api/v1/routes` y `/mission/plan` devuelven 200 con la forma de §4.4 (reemplaza `test_routes_not_implemented_yet`).

---

## 9. Plan de implementación y cronograma (sáb 17:00 → freeze dom 15:00)
Ramas y PRs según CONTRIBUTING: un PR por tarea, título en Conventional Commits, 1 aprobación, *Squash and merge*.

| # | Hora | Rama / PR | Entregable | Integración |
|---|---|---|---|---|
| 0 | Sáb 17:00 | `docs/mecb-context-update` — `docs: update Mec. B context…` | Este documento | Compartirlo con el equipo para acordar contratos |
| 1 | 17:00–18:00 | `build/backend-numpy-scipy` — `build(backend): add numpy and scipy` | Dependencias | — |
| 2 | 17:30–18:30 | `feat/backend-grid-spec` — `feat(backend): add GridSpec and synthetic terrain` | `grid.py`, `terrain.py`, `synthetic.py`, `fixtures/`, `mission_params.json`, DTOs vacíos | **Mocks publicados** → el Full stack dibuja |
| 3 | 18:30–21:00 | `feat/backend-eva-planner` — `feat(backend): implement PlanRoutes with Pandolf A*` | P-1…P-6, tests 1–4, 7; `POST /routes` real sobre sintético → luego `npy_terrain` local | **Checkpoint 19:00–21:00:** 3 rutas EVA en el mapa |
| 4 | 21:00–23:30 | `feat/backend-safety` — `feat(backend): add return field, PNR and alerts` | S-1, S-2, S-4, tests 5–6; `GET /return-field` | Isolínea y PNR en el mapa |
| 5 | Dom 08:30–10:30 | `feat/backend-rover-traverse` — `feat(backend): add SEV traverse planner` | R-1, R-2 (+R-3 si da), test 8; `POST /traverse` sobre la grilla regional | Ruta base → T01 en el mapa |
| 6 | 10:30–12:30 | `feat/backend-mission-plan` — `feat(backend): add PlanMission with sol timeline` | M-1, M-2, M-3, test 9; `POST /mission/plan` | **Checkpoint 13:00:** flujo completo globo → Gale → rover → EVA |
| 7 | 12:30–14:00 | `feat/backend-simulation` — `feat(backend): add EVA simulation and scenarios` | S-3, S-5 (`sep_event`, `suit_leak`), S-6 si da tiempo | HUD de `field-simulation` |
| 8 | 14:00–15:00 | `chore/demo-fallbacks` — `chore: generate demo fallback JSON` | `fallback_mission.json`, `fallback_simulation.json`; validación contra el traverse de Curiosity | **Freeze 15:00** |

**Definición de "hecho"**: función pura en `domain/` + test verde + DTO en `schemas.py` + ejemplo JSON en `tests/fixtures/` + `assumptions` con `kind`. CI verde (`pytest`, `npm run build`).

---

## 10. Protocolo de colaboración
- **Flujo:** el de [CONTRIBUTING.md](../CONTRIBUTING.md): nunca en `main`; rama `tipo/alcance-descripcion`; commits *Conventional Commits* (el hook `.githooks/commit-msg` los valida); PR con plantilla; 1 aprobación; *Squash and merge*.
- **Contratos:** solo se cambian con acuerdo en el chat del equipo. En el mismo PR se actualizan `schemas.py`, el `types.ts` de la feature y este documento. Los campos nuevos son opcionales; un cambio *breaking* lleva `!`.
- **Datos ajenos:** no edito `env.json`, `targets_v0.geojson` ni el terreno de otro rol. Pido el cambio por Issue o chat (CONTRIBUTING §7).
- **Mock → real:** el reemplazo no cambia la forma de la respuesta. El Full stack siempre puede caer a `fallback_*.json`.

---

## 11. Preguntas abiertas
1. ~~**Cobertura del DEM regional**~~: resuelto en la v1.0 de Mec. A, que cubre la franja base → boxwork a 10 m. **Pendiente:** una grilla gruesa (100–200 m) para la EZ de ≥100 km. (Mec. A)
2. **Umbrales del SEV:** la página NASA no da pendiente máxima, autonomía ni masa. ¿Hay una fuente primaria (DRA 5.0, documentos del MMSEV o Desert RATS) para reemplazar los supuestos de §4.5?
3. **Mover `physiology` y `reference_eva`** de `env.json` a `mission_params.json` (PR coordinado con el Estudiante) o dejarlos donde están.
4. ~~**Elevación de la base**~~: confirmada con el DEM v1.0 en **−4 497.8 m**, unos 763 m por debajo de T01 (−3 734.7 m).
5. **Ubicación del staging:** T01 (Rustic Canyon) se eligió como base de la EVA antes de que existiera el tramo rover. ¿Hay una celda más cercana a T05/T06 transitable para el SEV? (R-4)
6. **Rendimiento:** ¿A\* con numpy a 1 000 × 1 000 cumple < 5 s o hace falta submuestrear o usar `numba`?
