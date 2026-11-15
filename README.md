<div align="center">

# 🚀 SENDA v2 — Safe Paths to Martian Science

**Planificación de travesías del Pressurized Rover (SEV) y caminatas EVA en Mount Sharp, Cráter Gale**

[![NASA Gale EZ](https://img.shields.io/badge/NASA-Gale_Crater_EZ-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://science.nasa.gov/mission/msl-curiosity/)
[![React + TypeScript](https://img.shields.io/badge/Frontend-React_18_%2B_TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](frontend/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_%2B_Python_3.11%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](backend/)
[![Three.js 3D](https://img.shields.io/badge/3D_DEM-Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](frontend/src/features/terrain/components/Terrain3DView.tsx)
[![IBM Quantum Optional](https://img.shields.io/badge/Optional-IBM_Quantum_%2B_Qiskit-6929C4?style=for-the-badge&logo=qiskit&logoColor=white)](backend/src/senda/adapters/quantum_qiskit.py)

Monorepo con **backend** y **frontend** independientes (el frontend NASA funciona **100% standalone** o conectado al backend).

</div>

---

> 👥 **¿Eres del equipo?** Empieza por la **[Guía para el equipo (CONTRIBUTING.md)](CONTRIBUTING.md)**: requisitos, instalación, cómo crear ramas y Pull Requests, y reparto de tareas.
>
> 🔗 **Repositorio:** https://github.com/JhonAlex28/senda-mars

```text
senda-v2/
├── backend/    API Python · FastAPI · arquitectura hexagonal (+ puente opcional Qiskit)
├── frontend/   React · TypeScript · Vite · Three.js · organizado por features
└── scripts/    setup.py y dev.py (instalar y arrancar todo)
```

---

## ✨ Novedades principales (Rama `mathias`)

| Módulo | Qué incluye |
|---|---|
| 🗺️ **Gale Crater EZ & SEV** | Coordenadas oficiales NASA (`137.42009295°E, -4.59310427°S, -4497.77 m MOLA`), Exploration Zone `25 / 100 km`, vehículo **Pressurized Rover (SEV)** y modal técnico `Gale EZ & SEV`. |
| 🏔️ **Mapa 2D GIS + 3D DEM** | Pathfinding **A\*** sobre grilla de 8 vecinos, capas Viking/CTX, Minerales y Refugio, más vista 3D con cámaras `ORBIT`, `CHASE`, `POV`, `DRONE` y `FLYOVER`. |
| 🧑‍🚀 **Crew & Suit Health HUD** | Configuración de equipo, nombres de astronautas y trajes (`xEMU-01` / `xEMU-02`), más telemetría biométrica en vivo (`HelmetStatusCard`) y registro de muestras `MSR-Ti`. |
| 🌦️ **REMS / RAD Live** | Panel interactivo con opacidad de polvo ($\tau$), hora solar (`LMST`) y alertas de tormenta solar (`SPE`) conectados al checklist `GO / NO-GO` y al Monte Carlo de 1,000 corridas. |
| 📊 **Evaluación & Exportación** | Rúbrica científica NASA (`/15`), badge Pareto Optimal, Score unificado (`0–100` + Grado `A+–D`) y descarga en **JSON**, **CSV**, **GeoJSON** y **Print / PDF Dossier**. |
| ⚛️ **IBM Quantum QAOA (Opcional)** | Co-procesador opcional en `NASA Labs → ⚛ IBM Quantum QAOA` y `My goals`: simulador Statevector en el navegador + puente opcional a Qiskit / IBM Quantum Runtime (`AerSimulator`, `ibm_brisbane`, `ibm_torino`, `ibm_fez`) con modelo de ruido $T_1/T_2$. |

---

## ⚡ Inicio rápido

Requisitos: **Python 3.11+** y **Node.js 20+**.

```bash
git clone https://github.com/JhonAlex28/senda-mars.git
cd senda-mars
python scripts/setup.py   # una sola vez (~1 min): crea backend/.venv e instala todo
python scripts/dev.py     # arranca backend + frontend. Ctrl+C detiene ambos
```

- **Frontend:** http://localhost:5173
- **API y documentación:** http://localhost:8000/docs

> Si un puerto está ocupado, `dev.py` lo avisa. Para ver qué lo ocupa en Windows: `Get-NetTCPConnection -LocalPort 8000 -State Listen`.
> Para demos rápidas en la interfaz, usa los botones **`▶ Quick Demo`** y **`Reset`** en la barra superior.

---

## 🧱 Backend — arquitectura hexagonal (puertos y adaptadores)

```text
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
│   │   ├── outbound/             implementaciones de los puertos (JSON, terreno, DEM…)
│   │   └── quantum_qiskit.py     puente opcional QAOA con Qiskit Aer / IBM Quantum Runtime
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
2. Si necesita datos externos, un puerto (`Protocol`) en `application/ports/`.
3. El caso de uso en `application/use_cases/`.
4. El adaptador que implementa el puerto en `adapters/outbound/` y su registro en `container.py`.
5. El router y el DTO en `adapters/inbound/http/`.
6. Tests: unitario con un fake y de integración con `TestClient`.

### Ejecutar
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
# Opcional para habilitar Qiskit + IBM Quantum Runtime:
# pip install -e ".[quantum]"
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
| `POST /api/v1/quantum/optimize-route` | *(Opcional)* Optimizador QAOA de secuencia de objetivos (Qiskit Aer / IBM Quantum) |

Las tres alternativas son **safe** (evita pendientes y peligros), **scientific** (pasa cerca de los objetivos)
y **fast** (menor tiempo). El terreno es sintético (`adapters/outbound/terrain/synthetic.py`) hasta conectar el DEM real.

---

## 🎨 Frontend — organizado por features

```text
frontend/src/
├── app/            App raíz, estilos globales (Tailwind con paleta NASA JPL Mission Control)
├── pages/          GlobePage y MissionControlPage: componen features, sin lógica de negocio
├── features/       una carpeta por funcionalidad
│   ├── mission/          estado del plan (reducer + selectores), pasos guiados, Crew/Suit, NASA Labs, REMS/RAD
│   ├── route-planning/   API de rutas, comparador Pareto, solver QAOA opcional en TypeScript
│   ├── field-simulation/ modo Go: itinerario, reloj, emergencias en vivo, MSR cache, resumen & exportación
│   ├── map/              mapa SVG: proyección, zoom/arrastre, marcadores, agrupación
│   ├── terrain/          descarga y sombreado del terreno, vista 3D DEM (Three.js)
│   ├── targets/          catálogo de objetivos, ficha y lista "My goals"
│   ├── environment/      clima: "Can I go today?" y franja inferior
│   └── globe/            pantalla de inicio con el planeta 3D y anillos orbitales
└── shared/         código común: api/httpClient (+ fallback offline), hooks, ui, lib (geo, astar, format), types
```

### Flujo de la aplicación
1. **Globo**: girar Marte, elegir un sitio → *Explore base* (la base ya queda puesta; se mueve con *Change* o la herramienta *Move base*).
2. **Rover route**: tocar rocas en el mapa → *Add goal* (arrastrar para priorizar, o usar *Quick Demo*) → *Find rover routes* → elegir ruta.
3. **Spacewalks**: en cada parada del rover (`P1`, `P2`…) → *Plan spacewalk* → elegir ruta a pie.
4. Revisar clima (`REMS / RAD Live`), tripulación (`Crew & Suits`) y checklist `GO / NO-GO` → *Start mission*.
5. **Simulation**: en cada objetivo *Begin science task* → *Complete task*; *Contingency* (`Dust`, `SPE / Block`, `Suit Leak`), *Return to rover* y *Return to base* recalculan la ruta.
6. **Resumen final**: puntaje NASA (`/100`), muestras `MSR-Ti` y exportación en **JSON / CSV / GeoJSON / Print PDF Dossier**.

**Reglas:** cada feature expone lo público en su `index.ts`. Una feature no importa archivos internos de otra.
`shared/` no importa nada de `features/`. Todas las llamadas HTTP pasan por `shared/api/httpClient.ts`.

### Ejecutar
```powershell
cd frontend
npm.cmd install
npm.cmd run dev        # http://localhost:5173  (proxy /api -> localhost:8000)
npm.cmd run typecheck  # tsc -b
npm.cmd run build
```

---

## 💡 Recomendación
Trabajar fuera de OneDrive (o excluir `node_modules` y `.venv` de la sincronización).
