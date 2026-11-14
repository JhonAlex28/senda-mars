# Guía para el equipo

Repositorio: **https://github.com/JhonAlex28/senda-mars**

## 1. Requisitos (una sola vez)

| Herramienta | Versión | Descarga |
|---|---|---|
| Git | cualquiera reciente | https://git-scm.com/downloads |
| Python | 3.11 o superior | https://www.python.org/downloads/ (en Windows marca **"Add Python to PATH"**) |
| Node.js | 20 o superior (LTS) | https://nodejs.org |
| Editor | VS Code recomendado | https://code.visualstudio.com |

Comprueba en una terminal:
```bash
git --version
python --version     # en Mac/Linux puede ser python3
node --version
```

## 2. Descargar e instalar

```bash
git clone https://github.com/JhonAlex28/senda-mars.git
cd senda-mars
python scripts/setup.py
```

`setup.py` crea el entorno de Python (`backend/.venv`) e instala todo. Tarda alrededor de 1 minuto.

## 3. Ejecutar

```bash
python scripts/dev.py
```

- App: http://localhost:5173
- API y documentación interactiva: http://localhost:8000/docs
- **Ctrl+C** detiene todo.

> **Windows / PowerShell:** si `npm` da error de "scripts deshabilitados", usa `npm.cmd` o ejecuta una vez
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
> Si un puerto está ocupado: `Get-NetTCPConnection -LocalPort 8000 -State Listen` muestra qué lo usa.

## 4. Cómo trabajar (flujo con ramas)

**Nunca se trabaja directo en `main`.** Cada tarea va en su propia rama y entra por Pull Request.

```bash
# 1. Actualizar main
git checkout main
git pull

# 2. Crear tu rama
git checkout -b feat/frontend-map

# 3. Trabajar y guardar cambios
git add .
git commit -m "feat(frontend): add slope layer to map"

# 4. Subir tu rama
git push -u origin feat/frontend-map
```

Luego, en GitHub, aparece el botón **"Compare & pull request"**. Abre el PR, completa la plantilla y pide revisión a un compañero.
Cuando lo aprueben y los checks estén en verde ✅, se hace **Merge**.

### Convención de commits ([Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/))

Formato: **`tipo(alcance): descripción`**

```
feat(backend): add PlanRoutes use case
fix(frontend): correct map zoom on target select
refactor(backend): extract slope cost into domain service
docs: update setup instructions
```

| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de un error |
| `refactor` | Cambio de código que no agrega funcionalidad ni corrige errores |
| `perf` | Mejora de rendimiento |
| `test` | Agregar o corregir tests |
| `docs` | Solo documentación |
| `style` | Formato (espacios, comas…), sin cambiar lógica |
| `build` | Dependencias, scripts de instalación, configuración de build |
| `ci` | Workflows de GitHub Actions |
| `chore` | Mantenimiento que no encaja en lo anterior |
| `revert` | Revertir un commit anterior |

- **Alcance** (opcional): `backend`, `frontend`, `scripts`, `ci`…
- **Descripción**: en imperativo, minúscula, sin punto final, máximo ~72 caracteres (`add`, no `added`).
- **Cambio que rompe compatibilidad** (por ejemplo, cambiar un endpoint): agrega `!` → `feat(backend)!: rename /targets to /science-targets`.
- El repositorio trae un *hook* (`.githooks/commit-msg`) que **rechaza commits que no siguen el formato**. `setup.py` lo activa automáticamente.

### Nombres de rama

Formato: **`tipo/alcance-descripcion-corta`**, con los mismos tipos de los commits.

| Ejemplo | Para |
|---|---|
| `feat/backend-plan-routes` | funcionalidad nueva |
| `fix/frontend-map-zoom` | corrección |
| `refactor/backend-terrain-adapter` | reorganizar código |
| `test/backend-physics` | tests |
| `docs/setup-guide` | documentación |
| `chore/update-deps` | mantenimiento |

### Pull Requests

- **Título del PR** con el mismo formato que un commit: `feat(frontend): add OpenLayers map`.
- Un PR = una tarea. Si crece demasiado, divídelo.
- Al menos **1 aprobación** y checks en verde antes de hacer merge.
- Usa **Squash and merge**: todo el PR queda como un solo commit en `main` con el título del PR.
- Borra la rama después del merge (GitHub ofrece el botón).

### Antes de abrir el PR
```bash
# backend
cd backend
.venv/Scripts/python -m pytest      # Windows
.venv/bin/python -m pytest          # Mac/Linux

# frontend
cd frontend
npm run build
```
GitHub ejecuta lo mismo automáticamente en cada PR (pestaña **Actions**).

### Si tu rama quedó desactualizada
```bash
git checkout main && git pull
git checkout tu-rama
git merge main          # resuelve conflictos si aparecen; el commit de merge se acepta tal cual
```

## 5. Dónde va cada cosa

- **Backend** (`backend/src/senda/`) — arquitectura hexagonal:
  - `domain/`: lógica pura (A*, física, modelos). Sin FastAPI ni lectura de archivos.
  - `application/`: casos de uso y puertos (interfaces).
  - `adapters/`: HTTP (routers) y acceso a datos (JSON, DEM...).
- **Frontend** (`frontend/src/`):
  - `features/<nombre>/`: una carpeta por funcionalidad (`api/`, `hooks/`, `components/`, `types.ts`, `index.ts`).
  - `shared/`: código común. `pages/`: arma las features.

Más detalle en el [README](README.md).

## 6. Reparto inicial sugerido

| Área | Tarea | Rama |
|---|---|---|
| Backend | Caso de uso `PlanRoutes` + endpoint `POST /api/v1/routes` | `feat/backend-plan-routes` |
| Backend | Adaptador de terreno (grilla / DEM) | `feat/backend-terrain` |
| Frontend | Mapa OpenLayers (`features/map`) | `feat/frontend-map` |
| Frontend | Comparador de rutas (`features/route-planning`) | `feat/frontend-route-planning` |
| Integración | Simulación FIELD, datos y presentación | `feat/field-simulation` |

## 7. Reglas rápidas

- No subir `.env`, `node_modules/`, `.venv/` ni `dist/` (ya están en `.gitignore`).
- Si cambias un DTO del backend (`schemas.py`), actualiza el `types.ts` de la feature en el frontend.
- Commits pequeños, cada uno con un solo propósito y en formato Conventional Commits.
- ¿Dudas? Abre un *Issue* o pregunta en el grupo antes de cambiar algo de otra área.
