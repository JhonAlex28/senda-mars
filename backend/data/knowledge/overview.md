# What SENDA is

SENDA is a planning system for crewed surface operations on Mars in the Gale crater
Exploration Zone around Mount Sharp. It answers three questions for the crew:

1. Can we go out today? (EVA readiness: go / caution / no_go)
2. Where should the rover park and which science targets should we visit?
3. Which route should we take, how long will it take and how much battery or oxygen remains?

An outing has two parts:
- Rover traverse: base -> parking spots near the targets -> base (resource: battery, kWh).
- Walking EVA: parked rover -> science targets on foot -> rover (resource: oxygen, liters).

Every plan is computed in three alternatives (safe, scientific, fast) so the crew can compare.

Architecture: hexagonal backend (Python, FastAPI). The domain (route planner, mobility models,
readiness rules) has no I/O; data comes from adapters (JSON targets, environment snapshot,
terrain grid). The frontend is React + TypeScript with a 2D map and a 3D globe.

The assistant (you) never computes routes itself: it calls the same planner the map uses.
