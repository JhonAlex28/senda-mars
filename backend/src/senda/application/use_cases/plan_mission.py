"""Caso de uso: misión completa (M-1, M-2, M-3).

base --(rover)--> staging --(EVA, 3 perfiles)--> staging --(rover)--> base, + timeline por sol.
"""
from __future__ import annotations

from senda.application.planner_context import PlannerContext
from senda.application.use_cases.plan_routes import PlanRoutes
from senda.application.use_cases.plan_traverse import PlanTraverse
from senda.domain.models.mission import MissionPlan, Warning
from senda.domain.models.route import RouteProfile
from senda.domain.services.mission_timeline import build_timeline


class PlanMission:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, target_ids: list[str], profiles: list[RouteProfile],
                staging_target_id: str | None = None,
                base_lonlat: tuple[float, float] | None = None,
                departure_sol: int | None = None, departure_ltst_h: float = 6.0,
                timeline_profile: RouteProfile = RouteProfile.SAFE,
                scenario: str = "none") -> MissionPlan:
        params = self._ctx.params
        base = base_lonlat or params.base_lonlat
        staging = (self._ctx.target(staging_target_id) if staging_target_id
                   else self._ctx.default_staging())
        staging_ll = (staging.location.lon, staging.location.lat)

        traverse = PlanTraverse(self._ctx)
        out = traverse.execute(base, staging_ll)
        back = traverse.execute(staging_ll, base, battery_used_before_kwh=out.metrics.energy_kwh)

        eva = PlanRoutes(self._ctx).execute(target_ids, profiles, staging.id, staging.id, scenario)
        by_profile = {r.profile: r for r in eva.routes}
        chosen = by_profile.get(timeline_profile) or eva.routes[0]

        timeline, warnings = build_timeline(
            params.window, params.rover, departure_sol or params.window.sol, departure_ltst_h,
            out.metrics.time_min * 60.0, chosen.metrics.time_min, back.metrics.time_min * 60.0,
            chosen.profile)

        if not back.metrics.feasible:
            warnings.append(Warning("BATTERY_RESERVE", "Round trip uses the rover battery reserve."))
        if not chosen.metrics.feasible:
            warnings.append(Warning("EVA_INFEASIBLE",
                                    f"EVA ({chosen.profile.value}): {', '.join(chosen.infeasible_reasons)}"))
        if base_lonlat is not None:
            warnings.append(Warning("CUSTOM_BASE", "Base overridden by request."))
        feasible = out.metrics.feasible and back.metrics.feasible and chosen.metrics.feasible
        return MissionPlan(base_lonlat=base, staging_id=staging.id, staging_lonlat=staging_ll,
                           traverse_out=out, traverse_back=back, eva_routes=eva.routes,
                           timeline_profile=chosen.profile, timeline=timeline,
                           feasible=feasible, warnings=warnings)
