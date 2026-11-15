# Auditoría del frontend: funcionalidades y cómo están desarrolladas

> **Base auditada:** `main` @ `ac23437` (2026-11-15), después del merge del planificador (PR #4).
> **Alcance:** `frontend/` completo, unas 9 900 líneas de TS/TSX en 11 *features*, y su integración con la API.
> **Objetivo:** tener un inventario fiable antes de proponer cambios.
> - Las secciones 1 a 5 describen lo que **hay**.
> - La sección 6 lista los **hallazgos** (lo que conviene corregir).
> - La sección 7, las **oportunidades** ligadas a rover, EVA y seguridad.
>
> **Etiquetas** (mismo criterio que `kind` en `env.json`):
> - **real**: dato del backend o de una fuente NASA.
> - **modelado**: derivado con un modelo propio y declarado.
> - **inventado**: cifra o fórmula sin fuente, o texto estático presentado como dato.

---

## 1. Stack y arquitectura

| Aspecto | Implementación |
|---|---|
| Framework | React 18 + TypeScript 5 (`strict`, `noUnusedLocals`) + Vite 6 |
| Estilos | Tailwind 3 con *tokens* propios (`surface`, `on-surface`, `accent`, `route-*`…) en `tailwind.config.js` y `app/styles.css`. Iconos de Material Symbols |
| 3D | `three` 0.170: globo (`MarsGlobe3D`) y vista 3D del DEM (`Terrain3DView`) |
| Estado | `useReducer` + Context. No hay librería externa (ni Redux ni Zustand) |
| Red | Un único cliente: `shared/api/httpClient.ts` (`fetch` + `ApiError` con `detail` de FastAPI) |
| Datos asíncronos | `shared/hooks/useAsync.ts`. No hay caché entre componentes: cada `useTerrain` o `useReadiness` hace su propio *fetch* |
| Rutas de la app | No hay router. La pantalla depende de `MissionState.phase` (`globe` → `plan` → `walk` → `go`) |
| Configuración | `VITE_API_BASE_URL` (por defecto `/api/v1`). En desarrollo, Vite hace proxy de `/api` y `/health` → `localhost:8000` |
| Despliegue | Netlify (`netlify.toml`: `npm run build` → `dist`, SPA *fallback*). CI: `.github/workflows/frontend.yml` (`npm ci && npm run build`) |
| Tests | **Ninguno**: no hay Vitest, Jest ni Playwright. El CI solo compila |
| Idioma | Interfaz en inglés; comentarios en español. `lang="en"` y un parche para el traductor del navegador (`shared/lib/translatorSafeDom.ts`, `shared/ui/Text.tsx`) |

**Estructura por *features*** (`src/features/<feature>/{api,components,hooks,lib,state}` + `index.ts` como API pública):

```
app/            App.tsx (Providers + selección de pantalla), styles.css
pages/          GlobePage (inicio) · MissionControlPage (Plan / Walk / Go)
features/
  globe/            globo 3D, catálogo de sitios, tarjeta del sitio
  mission/          estado central, cabecera, tarjetas de planificación, modales "labs"
  targets/          catálogo de objetivos (API), ficha, lista ordenable
  route-planning/   API de rutas, comparador de perfiles, perfil de elevación, QAOA
  terrain/          API /terrain, render de relieve y pendiente, vista 3D
  map/              lienzo SVG con zoom, proyección, marcadores, clustering
  layers/           catálogo de capas, opacidad, overlays NASA Mars Trek
  environment/      clima y veredicto GO/CAUTION/NO GO (REMS/RAD)
  field-simulation/ modo Go: reloj, tramos, tareas, contingencias, resumen
  assistant/        copiloto (chat lateral) que planifica con el backend
shared/         httpClient, useAsync, geo y formato, UI base (Button, Card, Dialog, Meter, Tooltip…)
```

**Flujo de datos:**
- `MissionProvider` carga los objetivos (`GET /targets`) y pone la base del catálogo (`is_base`).
- Todas las acciones del usuario pasan por `missionReducer`.
- `invalidatePlan()` descarta las rutas cuando cambian la base, los objetivos, su orden o los peligros. Es un buen patrón: evita mostrar rutas obsoletas.

---

## 2. Flujo de pantallas (lo que ve el usuario)

| # | Pantalla | Componentes clave | Qué hace |
|---|---|---|---|
| 1 | **Globo** (`GlobePage`) | `InteractiveGlobe` → `MarsGlobe3D` (con *fallback* SVG `MarsGlobe`), `SiteCard`, lista de `SITES` | Marte en 3D con textura Viking MDIM 2.1 (teselas de NASA Mars Trek; si fallan, `public/assets/mars_texture_8k.jpg`). 5 sitios: solo **Mount Sharp · Gale EZ** está activo (centrado en la base Calef −4.5931, 137.4201). "Explore" → `openMission` |
| 2 | **Plan** (rover) | `MissionHeader`, `StepBanner`, `PlanningMap`, `MapToolbar`, `LayersPanel`, `MarsWeatherCard`, `SuppliesCard`, `BaseCard`, `GoalsCard`, `TraversePanel` (+ `VehicleSelectorCard`, `RouteComparator`) | Elegir y ordenar objetivos, mover la base, marcar zonas de peligro, pedir el recorrido del rover (`POST /routes/traverse`) y comparar los 3 perfiles. Herramienta "scout" (`astar`): vista previa base → punto con `POST /routes/path` |
| 3 | **Walk** (EVA) | `EvaPanel`, `ParkingChips`, `PlanRouteLayers`, detalle de terreno a 3 m alrededor del estacionamiento activo | Por cada estacionamiento P*n*, pedir la caminata (`POST /routes/eva`) y elegir perfil. `LaunchCard` aparece cuando todas las EVA están planificadas |
| 4 | **Go** (ejecución simulada) | `ExecutionView` → `ItineraryCard`, `ExecutionMap`, `ExecutionPanel` (+ `HelmetStatusCard`), `ScienceTaskCard`, `ContingencyDialog`, `ReplanToast`, `MissionSummary`, `WeatherStrip` | Reproduce el itinerario en el navegador (reloj ×N), con paradas, tareas científicas y 3 contingencias que replanifican con `POST /routes/path`. Ofrece volver al rover y volver a la base. Al final, resumen de lo planificado frente a lo realizado |
| — | **Copiloto** (en todas las pantallas salvo Go) | `AssistantPanel`, `useAssistant` | Chat con el LLM (Ollama) del backend (`/assistant/status`, `/assistant/chat`). Carga un plan completo (`planLoaded`) o cambia de vista (`viewChanged`) |
| — | **Modales de la cabecera** | `GaleConceptModal`, `NasaLabsModal` (+ `QuantumLabPanel`), `CrewSuitModal` | Contexto de la EZ de Gale y del SEV; "labs" (xEMU Monte Carlo, RIMFAX/SHERLOC, MSR, horizonte, QAOA); nombres de la tripulación y del traje |

---

## 3. Inventario por *feature*

| Feature | Archivos clave | Funcionalidad | Fuente de datos | Estado |
|---|---|---|---|---|
| **globe** | `MarsGlobe3D.tsx`, `marsTexture.ts`, `sites.ts`, `SiteCard.tsx` | Globo 3D (three.js) con arrastre, zoom y giro hacia el sitio elegido; marcadores de sitios | Teselas WMTS de NASA Mars Trek (**real**); `SITES` *hardcodeado* | ✅ Funciona. Los sitios no activos son decorativos |
| **mission** (estado) | `state/types.ts`, `missionReducer.ts`, `MissionContext.tsx`, `selectors.ts` | Fases, base, objetivos ordenados, peligros, herramienta del mapa, plan del rover, EVA por estacionamiento, vehículo, tripulación, controles "¿y si…?", resumen cuántico, avisos. Historial de procedimientos en `localStorage` | Backend + usuario | ✅ Sólido. `invalidatePlan` y los selectores (`planStep`, `planReserve`) están bien pensados |
| **mission** (UI de planificación) | `BaseCard`, `GoalsCard`, `TraversePanel`, `EvaPanel`, `LaunchCard`, `StepBanner`, `MapToolbar`, `PlanningMap`, `PlanRouteLayers`, `ParkingChips` | Flujo guiado Goals → Rover → Spacewalks → Start; edición de la base por mapa o coordenadas; peligros de 60 m (Plan) o 12 m (Walk); vista 2D/3D | Backend (`/routes/*`) | ✅ Flujo completo y conectado al backend |
| **mission** (extras) | `MissionHeader` (Quick Demo, Reset), `VehicleSelectorCard`, `MarsWeatherCard`, `CrewSuitModal`, `HelmetStatusCard`, `GaleConceptModal`, `NasaLabsModal`, `QuantumLabPanel` | Demo con los 3 primeros objetivos; tarjeta del vehículo; simulador de clima "¿y si…?"; tripulación; HUD del casco; modales informativos | Mayormente **modelado** o **inventado** (ver §5) | ⚠️ Ver hallazgos |
| **targets** | `targetsApi.ts`, `TargetCard.tsx`, `GoalList.tsx`, `lib/stars.ts` | Catálogo (`GET /targets`), ficha con estrellas (rúbrica sobre 15), lista ordenable por arrastre o teclado | Backend (`targets_v1.geojson`, **real**) | ✅. `GET /targets/{id}` existe pero no se usa |
| **route-planning** | `routesApi.ts`, `types.ts`, `RouteComparator`, `RouteOptionCard`, `ElevationProfileSVG`, `lib/profiles.ts`, `lib/qaoaSolver.ts` | Llamadas `/routes/traverse`, `/routes/eva`, `/routes/path`; comparación de perfiles (muestra solo las opciones distintas); perfil de elevación; QAOA en el navegador o por backend | Backend (**real**/modelado); QAOA **modelado** con distancias en línea recta | ✅ Rutas. ⚠️ QAOA (ver §6) |
| **terrain** | `terrainApi.ts`, `useTerrain.ts`, `renderTerrain.ts`, `Terrain3DView.tsx`, `TerrainReadout.tsx` | `GET /terrain` (sitio a 10 m; detalle a 3 m en Walk); relieve con sombreado, pendiente coloreada, lectura bajo el cursor, 3D con 5 cámaras | Backend: DEM USGS de Mec. A (**real**) | ✅. ⚠️ El JSON es grande (ver §6.3) |
| **map** | `MapCanvas.tsx`, `projection.ts`, `markers.tsx`, `Clustered.tsx`, `usePanZoom.ts`, `ScaleBar`, `MapLegend` | Lienzo SVG en metros (equirectangular local), rásteres georreferenciados, *pan* y zoom, clustering por distancia en pantalla, escala | Interno | ✅ Bien encapsulado |
| **layers** | `catalog.ts`, `LayersContext.tsx`, `LayersPanel.tsx`, `lib/rasters.ts` | 8 capas con procedencia, fuente, resolución, opacidad y leyenda. "Orbital photo" (CTX 6 m/px de Mars Trek), "Minerals" y "Radiation shelter" se pintan en el cliente | Relieve y pendiente: backend (**real**/modelado). Foto CTX: **real**. Minerales y refugio: **modelado** con reglas propias (ver §6.2) | ⚠️ |
| **environment** | `environmentApi.ts`, `useReadiness.ts`, `WeatherStrip`, `ReadinessBadge`, `lib/verdict.ts` | Veredicto GO/CAUTION/NO GO con 4 chequeos (temperatura, viento, polvo, radiación) | Backend (`/environment/readiness`, REMS/RAD, **real**) | ✅ |
| **field-simulation** | `simulationReducer.ts`, `useSimulation.ts`, `lib/itinerary.ts`, `ExecutionPanel`, `ExecutionMap`, `MissionSummary`, `ContingencyDialog`, `ReplanToast`, `ScienceTaskCard` | Reloj de 100 ms (×N), interpolación sobre los `points` de las rutas, llegada a paradas, tareas, saltar parada, contingencias (bloqueo, polvo ×0.7, fuga ×1.5 de O₂), volver al rover o a la base, rastro de tramos reemplazados, resumen | Rutas del backend + **simulación en el cliente**. No usa `/simulate`, `/return-field` ni `/scenarios` | ✅ Funciona. ⚠️ No usa el motor de seguridad (ver §6.1) |
| **assistant** | `assistantApi.ts`, `useAssistant.ts`, `AssistantPanel.tsx` | Chat con historial, estado del modelo (`checking/ready/disabled/offline/no-backend`), aplica el plan del asistente en pantalla | Backend (`/assistant/*`) | ✅. Desactivado en producción (`SENDA_ASSISTANT_ENABLED=false`) |
| **shared** | `httpClient.ts`, `useAsync.ts`, `lib/geo.ts`, `lib/format.ts`, `ui/*` | Cliente HTTP, geodesia aproximada (R = 3 389 500 m), formato, componentes UI accesibles (`Switch` con `role="switch"`, `Tooltip` en *portal*) | — | ✅ |

---

## 4. Integración con el backend

### 4.1 Endpoints usados y no usados

| Endpoint | ¿Lo usa el frontend? | Dónde |
|---|---|---|
| `GET /targets` | ✅ | `MissionProvider` |
| `GET /targets/{id}` | ❌ | — |
| `GET /environment` | ❌ (hay hook, `useEnvironment`, pero no se usa en la UI) | — |
| `GET /environment/readiness` | ✅ | Globo, Plan, Go |
| `GET /terrain` | ✅ | Sitio a 10 m; detalle a 3 m en Walk |
| `POST /routes/traverse` | ✅ | `usePlanning.planTraverse` (envía `vehicle_id` y `speed_kmh`) |
| `POST /routes/eva` | ✅ | `usePlanning.planEva` |
| `POST /routes/path` | ✅ | Scout en el mapa, contingencias y retornos en Go |
| `GET /assistant/status`, `POST /assistant/chat` | ✅ | `AssistantPanel` |
| `POST /quantum/optimize-route` | ✅ (solo en modo "IBM") | `QuantumLabPanel`; si falla, usa el QAOA del navegador |
| `POST /mission/plan` | ❌ | — |
| `POST /simulate` | ❌ | — |
| `GET /return-field` (+ PNG) | ❌ | — |
| `GET /scenarios` | ❌ | — |

### 4.2 El contrato TS está atrasado respecto al backend
`route-planning/types.ts → RoutePlan` no declara los campos opcionales que ya envía el backend:
- `pnr_index`: punto de no retorno;
- `reserve_min`: reserva mínima de retorno;
- `infeasible_reasons`;
- `terrain_cell_m`: 4 m en el boxwork, 10 m fuera.

Por eso la UI **no muestra** el punto de no retorno, la reserva ni los motivos de inviabilidad, y no advierte cuándo una EVA se planificó con terreno de 10 m.

---

## 5. Procedencia de lo que se muestra (real, modelado o inventado)

| Elemento de UI | Clasificación | Detalle |
|---|---|---|
| Objetivos, base, rúbrica y tareas | **real** | `targets_v1.geojson` (NASA MMGIS), servido por el backend |
| Relieve y pendiente del mapa | **real** / modelado | DEM USGS de Mec. A vía `/terrain` |
| Rutas, distancia, tiempo, batería (kWh), O₂ (L), `return_ok`, `safety_pct` | **modelado** (motor de Mec. B) | Pandolf, energía del SEV y campo de retorno |
| Veredicto del clima (REMS/RAD) | **real** | `/environment/readiness` |
| Globo y foto orbital CTX | **real** | NASA Mars Trek WMTS |
| "Try a scenario" (`MarsWeatherCard`) | **modelado** (declarado) | Fórmulas propias de temperatura, presión, dosis y autonomía (`tempC = −84 + 88·sin(…)`, `rangeKm = 100·e^(−0.21·Δτ)`) |
| Ajuste de batería por polvo (`LaunchCard`) | **inventado** | `dustPenaltyPct = (τ − 0.62)·14`. Bloquea el despegue con menos de 15 % de batería |
| Capa "Minerals" | **modelado** (débil) | Franjas de elevación fijas, calibradas para el boxwork (−3 685 / −3 645 / −3 618 m), + textura THEMIS. Con el sitio v1 (−4 520 a −3 605 m), casi todo sale como "Murray" |
| Capa "Radiation shelter" | **inventado** | Regla `pendiente > 7° y elevación < 65 % del rango`. La fuente dice "Curiosity RAD", pero RAD no da un mapa de blindaje |
| Especificaciones de vehículos (`vehicles.ts`) | **inventado** / incoherente | SEV a 8 km/h, 42 kWh y 100 km de autonomía, frente a `mission_params.json`: 5 km/h nominal, 10 km/h máx. y 100 kWh. Hay LTV e híbrido aunque el MVP es solo SEV (doc §0.4) |
| `NasaLabsModal` (xEMU Monte Carlo, RIMFAX/SHERLOC, MSR, horizonte) | **inventado** | O₂ = `distKm·62·(1 + 0.014·masa)…`; histograma "1 000 corridas" independiente del motor; texto estático de RIMFAX y SHERLOC, **instrumentos de Perseverance (Jezero), no de Curiosity en Gale** |
| `HelmetStatusCard` y vitales en Go | **inventado** | Pulso = reposo + 42 + 4·sin(t); temperatura del LCVG y CO₂ con fórmulas fijas |
| QAOA (`qaoaSolver.ts`) | **modelado** | Simulador de *statevector* real, pero con distancias en línea recta y energía `km·(1.65 + 0.035·v)` (no el modelo del SEV). Puede **reordenar o quitar** objetivos (`applyQuantumGoals`) |
| Tripulación por defecto | **ficción** | "WATNEY" y "LEWIS" son nombres de personajes de *The Martian*. Conviene usar nombres neutros (p. ej. "EVA-1" y "EVA-2") |

---

## 6. Hallazgos (priorizados)

### 6.1 Alta: afectan la coherencia con el motor de seguridad
1. **La ejecución (Go) no usa el motor de seguridad.**
   - **Qué pasa:** la simulación interpola los `points` de las rutas en el cliente. No hay campo de retorno, punto de no retorno ni alertas `rtb`.
   - **Contingencias:** solo hay 3 (bloqueo, polvo, fuga), contra los 5 escenarios del backend (falta `sep_event`, que es la alerta solar, y `injury`).
   - **Endpoints sin usar:** `/simulate`, `/return-field` y `/scenarios`.
   - **Consecuencia:** el usuario no ve cuándo debe volver aunque el backend ya lo calcula.
2. **El contrato TS desactualizado** (§4.2) oculta `pnr_index`, `reserve_min`, `infeasible_reasons` y `terrain_cell_m`.
3. **Las especificaciones de los vehículos no coinciden con el backend.** La tarjeta del SEV muestra 42 kWh y 100 km, mientras el backend planifica con 100 kWh. La velocidad por defecto de 8 km/h se traduce en un `speed_factor` de 1.6 sobre la nominal de 5 km/h, así que **el backend planifica con más velocidad de la nominal sin que el usuario lo sepa**. LTV e híbrido se planifican como SEV.
4. **La decisión de despegue mezcla datos reales con el simulador "¿y si…?".** `MarsWeatherCard` dice que el simulador "solo cambia el chequeo de salida, no las rutas", pero `LaunchCard` aplica `dustPenaltyPct` y `speActive` para bloquear el despegue. El umbral de 15 % de batería tampoco coincide con la reserva del 30 % del backend.

### 6.2 Media: datos o etiquetas que pueden engañar
5. **Umbrales de pendiente distintos al backend.**
   - El render (`renderTerrain.ts`) y la leyenda usan 10° y **18°**; `RouteOptionCard` avisa de pendiente desde 10°.
   - El backend usa **10/20°** para EVA y **15/25°** para el rover.
   - El mapa colorea de rojo zonas que el rover sí puede cruzar.
6. **Las capas "Minerals" y "Radiation shelter"** se presentan con fuentes NASA, pero son reglas propias (ver §5). Mínimo: etiquetarlas como **ilustrativas**. Mejor: sustituirlas por datos reales o quitarlas.
7. **`NasaLabsModal`**: cifras sin fuente y un instrumento equivocado (RIMFAX y SHERLOC son de Perseverance). Riesgo ante los jueces, porque el doc pide fuentes oficiales.
8. **Las capas de Mec. A** (`frontend/public/data/layers/{slope,risk}_{local,regional}.png` + `.json`) **no se usan**: el mapa recalcula la pendiente desde `/terrain`. Los `public/data/fallback_*.json` tampoco se leen desde que se retiró el modo sin backend ("stop inventing data").
9. **Nombres de personajes de *The Martian*** en la tripulación por defecto, y la descripción "NASA/The-Martian style" del HUD.

### 6.3 Baja: técnica, rendimiento y mantenimiento
10. **Tamaño de `/terrain`:** el sitio entero va como JSON con dos listas de floats (`elevation_m` y `slope_deg`, hasta unas 400 k celdas cada una, varios MB). Cada `useTerrain` repite el *fetch* (no hay caché compartida). Conviene un PNG o binario del backend, o reutilizar los PNG de Mec. A.
11. **Los overlays de Mars Trek** se componen en un canvas de **256×256 px** para todo el sitio (unos 7 × 14 km), así que la foto CTX de 6 m/px queda en un efectivo de unos 30–55 m/px.
12. **Sin tests en el frontend.** El reducer de la misión, el de la simulación e `itinerary.ts` son lógica pura y muy testeable (Vitest).
13. **`useAsync` sin caché ni cancelación de la petición** (solo ignora el resultado); `GoView` fija el itinerario con un `eslint-disable`.
14. **Activos sin procedencia.** `public/assets/media_*.jpg` tiene nombres generados y `mars_texture_8k.jpg` pesa 44 KB, así que no es una textura de 8K. Sus créditos no figuran en la UI.
15. **`useEnvironment` y `targetsApi.get`** no se usan (código muerto menor).
16. **Despliegue:** Netlify solo publica el frontend. La URL del backend depende de `VITE_API_BASE_URL` configurada en Netlify, y sin backend la app muestra "Cannot reach the SENDA server".

---

## 7. Oportunidades ligadas a rover, EVA y seguridad (para la siguiente fase)

| Prioridad | Cambio propuesto | Archivos afectados |
|---|---|---|
| 1 | Actualizar el contrato TS (`pnr_index`, `reserve_min`, `infeasible_reasons`, `terrain_cell_m`) y mostrarlo en `RouteDetails`: marcador del punto de no retorno en el mapa, reserva y aviso "terreno 10 m" | `route-planning/types.ts`, `RouteOptionCard.tsx`, `PlanRouteLayers.tsx`, `map/markers.tsx` |
| 2 | Capa **"Safe return zone"** con `GET /return-field?leg=eva&lon&lat` (PNG + bbox) para el estacionamiento activo, y otra para el rover | `layers/catalog.ts`, `layers/lib/rasters.ts`, nueva API `safetyApi` |
| 3 | Modo Go con el motor de seguridad: catálogo de `GET /scenarios` (añade `sep_event` e `injury`), `POST /simulate` para la línea de tiempo de O₂ restante, retorno y alertas `rtb`, y el desvío propuesto | `field-simulation/*` |
| 4 | Alinear vehículo y umbrales con `mission_params.json`: SEV de 100 kWh, 5 km/h nominal y 10 km/h máx.; ocultar LTV e híbrido; leyenda 10/20° (EVA) y 15/25° (rover); reserva del 30 % | `mission/state/vehicles.ts`, `VehicleSelectorCard.tsx`, `renderTerrain.ts`, `LaunchCard.tsx` |
| 5 | Usar las capas de Mec. A (`public/data/layers/*.png` con `bbox_lonlat`) para pendiente y riesgo, en vez de recalcularlas | `layers/*` |
| 6 | Marcar como "ilustrativo" o retirar lo inventado: minerales, refugio, NASA Labs y vitales del casco | `layers/catalog.ts`, `NasaLabsModal.tsx`, `HelmetStatusCard.tsx` |
| 7 | Tests con Vitest para `missionReducer`, `simulationReducer` e `itinerary`, y añadirlos al CI | `frontend/package.json`, `.github/workflows/frontend.yml` |

> **Coordinación:** el frontend lo mantiene el Full stack, que además está rediseñando la interfaz. Antes de tocar componentes de UI hay que acordar el alcance con él. Los cambios 1–4 son de **contrato y datos** del motor de Mec. B y son los que más sentido tiene que lleve Mec. B.

---

## 8. Estado: ronda 1 aplicada (2026-11-15)

| Hallazgo | Cambio |
|---|---|
| 4.2 Contrato TS atrasado | `RoutePlan` incluye `pnr_index`, `reserve_min`, `infeasible_reasons` y `terrain_cell_m`. `RouteDetails` muestra la reserva de retorno, los motivos (chips), "10 m terrain" (solo en EVA) y el marcador **PNR** en el mapa |
| 6.1-1 Seguridad no visible | Capa **Safe return**: `GET /return-field` + `safe-mask.png`. En Walk usa la parada activa; en Plan, la base. Nueva feature `features/safety`. El modo Go con `/simulate` queda para la ronda 2 |
| 6.1-3 Vehículo incoherente | Solo SEV, con datos de la ficha NASA: 2 tripulantes, 14 días, ~10 km/h. Sin slider de velocidad ni LTV o híbrido; el backend usa la velocidad nominal |
| 6.1-4 Despegue con el "¿y si…?" | Se eliminó el simulador. El despegue lo deciden el clima real (REMS/RAD) y `return_ok` del motor |
| 6.2-5 Umbrales | Leyenda y render en 10/20° para EVA. Aviso de pendiente a 10° en EVA y 15° en vehículo |
| 6.2-6/7 Datos sin fuente | Foto orbital, minerales y refugio quedan como "Coming soon" con candado (las integra el compañero de capas ópticas). **Labs** y **Quantum** bloqueados ("Soon"). Se quitaron NASA Labs, Quantum Lab, el QAOA de Goals y el "MSR sample cache" |
| 6.2-9 Nombres de *The Martian* | Tripulación por defecto: EVA-1 y EVA-2 |
| Cabecera | Texto fijo de REMS → `ReadinessBadge` real. Botones de icono + 1 palabra, de 44 px |

**Otros cambios pedidos:**
- Términos **Vehicle** y **EVA**: los pasos son Goals · Vehicle · EVA · Start.
- Sin "Move base", porque las bases son fijas.
- **Add point**: el usuario marca puntos de paso W1… que el backend intercala en la ruta del vehículo (`waypoints` en `/routes/traverse`).
- **Crew config** en la planificación (solo parámetros) y **Crew status** en Go (HUD del casco, con vitales marcados como simulados).
- Iconos por tipo científico: agua, minerales, taladro y geología. Capa "Target names" para tableta.
- Textos más cortos en paneles, contingencias y resumen.
