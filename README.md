# SENDA v2 — Safe Paths to Martian Science

Planificación de caminatas (EVA) en el Monte Sharp, cráter Gale.
Monorepo con **backend** y **frontend** independientes.

```
senda-v2/
├── backend/    API Python · FastAPI · arquitectura hexagonal
├── frontend/   React · TypeScript · Vite · organizado por features
└── scripts/    setup.py y dev.py (instalar y arrancar todo)
```

## Inicio rápido

Requisitos: **Python 3.11+** y **Node.js 20+**.

```bash
git clone <url-del-repo>
cd <repo>
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

| Endpoint | Estado |
|---|---|
| `GET /health` | ✅ |
| `GET /api/v1/targets`, `GET /api/v1/targets/{id}` | ✅ |
| `GET /api/v1/environment` | ✅ |
| `POST /api/v1/routes` | 🚧 501 (caso de uso `PlanRoutes` pendiente) |

## Frontend — organizado por features

```
frontend/src/
├── app/            App raíz, estilos globales, providers
├── pages/          páginas: componen features, sin lógica de negocio
├── features/       una carpeta por funcionalidad
│   ├── targets/        api/ hooks/ components/ types.ts index.ts   ✅
│   ├── environment/    api/ hooks/ components/ types.ts index.ts   ✅
│   ├── map/            🚧 OpenLayers
│   ├── route-planning/ 🚧 comparador de rutas, perfil de elevación
│   └── field-simulation/ 🚧 HUD, emergencias, replanificación
└── shared/         código común: api/httpClient, hooks, ui, config, types
```

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
