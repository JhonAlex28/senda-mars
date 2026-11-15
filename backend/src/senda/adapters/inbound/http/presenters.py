"""Helpers de presentación compartidos por los routers del planner."""
from __future__ import annotations

from senda.adapters.inbound.http.schemas import AssumptionOut, GridInfoOut
from senda.application.planner_context import PlannerContext
from senda.domain.models.terrain import TerrainGrid


def grid_info(t: TerrainGrid) -> GridInfoOut:
    b = t.spec.bbox
    return GridInfoOut(scale=t.scale.value, kind=t.kind, cell_size_m=t.spec.cell_size_m,
                       shape=t.spec.shape, bbox_lonlat=(b.min_lon, b.min_lat, b.max_lon, b.max_lat),
                       sources=t.sources)


def assumptions(ctx: PlannerContext, *grids: TerrainGrid) -> dict[str, AssumptionOut]:
    out = {k: AssumptionOut(**v) for k, v in ctx.params.assumptions().items()}
    for i, g in enumerate(grids):
        # si la EVA usa un recorte regional, no debe pisar la entrada de la grilla regional
        dup = any(o.scale == g.scale for o in grids[i + 1:])
        key = "terrain.eva" if dup else f"terrain.{g.scale.value}"
        out[key] = AssumptionOut(
            value={"cell_size_m": g.spec.cell_size_m, "shape": list(g.spec.shape)},
            kind="synthetic" if g.kind == "synthetic" else "medido",
            source="; ".join(s.get("name", "") for s in g.sources) or "terrain")
    return out
