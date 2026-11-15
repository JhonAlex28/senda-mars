# SENDA v2 — Safe Paths to Martian Science

Planificación de caminatas (EVA) en el Monte Sharp, cráter Gale.
Monorepo con **backend** y **frontend** independientes.

> 👥 **¿Eres del equipo?** Empieza por la **[Guía para el equipo (CONTRIBUTING.md)](CONTRIBUTING.md)**: requisitos, instalación, cómo crear ramas y Pull Requests, y reparto de tareas.
>
> Repo: https://github.com/JhonAlex28/senda-mars

```
senda-v2/
├── backend/    API Python · FastAPI · arquitectura hexagonal
├── frontend/   React · TypeScript · Vite · organizado por features
└── scripts/    setup.py y dev.py (instalar y arrancar todo)
```

## Inicio rápido

Requisitos: **Python 3.11+** y **Node.js 20+**.

```bash
git clone https://github.com/JhonAlex28/senda-mars.git
cd senda-mars
python scripts/setup.py   # una sola vez (~1 min): crea backend/.venv e instala todo
python scripts/dev.py     # arranca backend + frontend. Ctrl+C detiene ambos
```

- Frontend: http://localhost:5173
- API y documentación: http://localhost:8000/docs

Si un puerto está ocupado, `dev.py` lo avisa. Para ver qué lo ocupa en Windows: `Get-NetTCPConnection -LocalPort 8000 -State Listen`.

## Backend — arquitectura hexagonal (puertos y adaptadores)

```
backend/
├── data/                         targets_v0.geojson, env.json
├── src/senda/
│   ├── domain/                   ← núcleo: Python puro, sin FastAPI ni I/O
│   │   ├── models/               entidades y value objects (GeoPoint, ScienceTarget, RoutePlan…)
│   │   ├── services/             lógica pura: pathfinding (A*), physics (Pandolf, O2)
│   │   └── errors.py
│   ├── application/              ← orquesta el dominio
│   │   ├── ports/outbound.py     interfaces que la app necesita (TargetRepository, TerrainProvider…)
│   │   └── use_cases/            ListTargets, GetEnvironment, PlanRoutes…
│   ├── adapters/                 ← mundo exterior
│   │   ├── inbound/http/         FastAPI: routers, schemas (DTOs), dependencies
│   │   └── outbound/             implementaciones de los puertos (JSON, terreno, DEM…)
│   ├── config.py                 variables de entorno
│   ├── container.py              composition root: elige qué adaptador usar
│   └── main.py                   crea la app FastAPI
└── tests/
    ├── unit/                     dominio y casos de uso (con repositorios falsos)
    └── integration/              API completa con TestClient
```

**Regla de dependencias:** `adapters → application → domain`. El dominio no importa nada de afuera.
Cambiar JSON por una base de datos, o terreno sintético por un DEM real, solo toca `adapters/` y `container.py`.

### Cómo agregar una funcionalidad
1. Modelo o lógica pura en `domain/`.
2. Si necesita datos externos, un puerto (Protocol) en `application/ports/`.
3. El caso de uso en `application/use_cases/`.
4. El adaptador que implementa el puerto en `adapters/outbound/` y su registro en `container.py`.
5. El router y el DTO en `adapters/inbound/http/`.
6. Tests: unitario con un fake y de integración con TestClient.

### Ejecutar
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn senda.main:app --reload       # http://localhost:8000/docs
```

| Endpoint | Qué hace |
|---|---|
| `GET /health` | Estado del servicio |
| `GET /api/v1/targets`, `GET /api/v1/targets/{id}` | Objetivos científicos (con su tarea planificada) |
| `GET /api/v1/environment` | Condiciones ambientales del sol |
| `GET /api/v1/environment/readiness` | ¿Se puede salir hoy? GO / CAUTION / NO-GO con cada medición y su fuente |
| `GET /api/v1/terrain?cell_size_m=&min_lon=…` | Grilla de elevación y pendiente (todo el sitio o una ventana) |
| `POST /api/v1/routes/traverse` | Rover: base → estacionamientos propuestos → base, 3 alternativas |
| `POST /api/v1/routes/eva` | Caminata: rover → objetivos cercanos → rover, 3 alternativas |
| `POST /api/v1/routes/path` | Ruta por waypoints (contingencias y retornos) |

Las tres alternativas son **safe** (evita pendientes y peligros), **scientific** (pasa cerca de los objetivos)
y **fast** (menor tiempo). El terreno es sintético (`adapters/outbound/terrain/synthetic.py`) hasta conectar el DEM real.

## Frontend — organizado por features

```
frontend/src/
├── app/            App raíz, estilos globales (Tailwind con los tokens del diseño)
├── pages/          GlobePage y MissionControlPage: componen features, sin lógica de negocio
├── features/       una carpeta por funcionalidad
│   ├── mission/          estado del plan (reducer + selectores), pasos guiados, paneles Plan/Walk
│   ├── route-planning/   API de rutas, comparador de alternativas
│   ├── field-simulation/ modo Go: itinerario, reloj, tareas científicas, contingencias, resumen
│   ├── map/              mapa SVG: proyección, zoom/arrastre, marcadores, agrupación
│   ├── terrain/          descarga y sombreado del terreno, lectura bajo el cursor
│   ├── targets/          catálogo de objetivos, ficha y lista "My goals"
│   ├── environment/      clima: "Can I go today?" y franja inferior
│   └── globe/            pantalla de inicio con el planeta
└── shared/         código común: api/httpClient, hooks, ui, lib (geo, format), types
```

### Flujo de la aplicación
1. **Globo**: girar Marte, elegir un sitio → *Explore base* (la base ya queda puesta; se mueve con *Change* o la herramienta *Move base*).
2. **Rover route**: tocar rocas en el mapa → *Add goal* (arrastrar para priorizar) → *Find rover routes* → elegir ruta.
3. **Spacewalks**: en cada parada del rover (P1, P2…) → *Plan spacewalk* → elegir ruta a pie.
4. Revisar clima y recursos (Weather / Rover battery / Suit oxygen) → *Start mission*.
5. **Simulation**: en cada objetivo *Begin science task* → *Complete task*; *Contingency*, *Return to rover* y *Return to base* recalculan la ruta.
6. Resumen final: realizado frente a planificado.

**Reglas:** cada feature expone lo público en su `index.ts`. Una feature no importa archivos internos de otra.
`shared/` no importa nada de `features/`. Todas las llamadas HTTP pasan por `shared/api/httpClient.ts`.

### Ejecutar
```powershell
cd frontend
npm.cmd install
npm.cmd run dev        # http://localhost:5173  (proxy /api -> localhost:8000)
npm.cmd run build
```

## Recomendación
Trabajar fuera de OneDrive (o excluir `node_modules` y `.venv` de la sincronización).
