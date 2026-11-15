"""Adaptador: arma MissionParams desde env.json (Estudiante) + mission_params.json (Mec. B).

Cada parámetro se registra en `assumption_table` con valor, kind y fuente para que la UI
muestre qué es medido, modelado o supuesto.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from senda.domain.models.params import (DEFAULT_PROFILES, EvaParams, MissionParams, MissionWindow,
                                        ProfileWeights, RoverParams)
from senda.domain.models.route import RouteProfile
from senda.domain.services.mission_timeline import ltst_to_hours


class JsonMissionParamsRepository:
    def __init__(self, env_path: Path, params_path: Path) -> None:
        self._env_path = env_path
        self._params_path = params_path
        self._cache: MissionParams | None = None

    def get(self) -> MissionParams:
        if self._cache is None:
            self._cache = self._load()
        return self._cache

    def _load(self) -> MissionParams:
        env = json.loads(self._env_path.read_text(encoding="utf-8"))
        mp = json.loads(self._params_path.read_text(encoding="utf-8")) if self._params_path.exists() else {}
        table: dict[str, dict[str, Any]] = {}

        def note(key: str, value: Any, kind: str, source: str) -> Any:
            table[key] = {"value": value, "kind": kind, "source": source}
            return value

        phys = env.get("physiology", {})
        phys_src = phys.get("source", "env.json → physiology")
        phys_kind = phys.get("kind_es", "modelado")
        rad = env.get("radiation", {})
        dust = env.get("dust", {})
        classes = env.get("terrain_classes", {})
        mpe = mp.get("eva", {})
        d = EvaParams()
        eva = EvaParams(
            body_kg=note("eva.body_kg", float(phys.get("astronaut_mass_kg", d.body_kg)), phys_kind, phys_src),
            load_kg=note("eva.load_kg", float(phys.get("suit_and_plss_mass_kg", d.load_kg)), phys_kind, phys_src),
            g_ratio=note("eva.g_ratio", d.g_ratio, "físico", "3.721 / 9.80665"),
            suit_multiplier=note("eva.suit_multiplier", float(phys.get("suit_metabolic_multiplier", d.suit_multiplier)), phys_kind, phys_src),
            terrain_factor_eta=note("eva.terrain_factor_eta", float(phys.get("terrain_factor_eta", d.terrain_factor_eta)), phys_kind, "Pandolf et al. 1977"),
            v_nominal_m_s=note("eva.v_nominal_m_s", float(phys.get("nominal_walking_speed_m_s", d.v_nominal_m_s)), phys_kind, phys_src),
            caution_speed_factor=note("eva.caution_speed_factor", float(mpe.get("caution_speed_factor", d.caution_speed_factor)), "supuesto", "mission_params.json"),
            stop_rate_w=note("eva.stop_rate_W", float(phys.get("stop_science_metabolic_rate_W", mpe.get("stop_rate_W", d.stop_rate_w))), phys_kind, phys_src),
            kj_per_l_o2=note("eva.kJ_per_L_O2", float(phys.get("energy_to_o2_kJ_per_L", d.kj_per_l_o2)), phys_kind, phys_src),
            o2_capacity_l=note("eva.o2_capacity_L", float(phys.get("plss_o2_capacity_L", d.o2_capacity_l)), phys_kind, phys_src),
            return_safety_factor=note("eva.return_safety_factor", float(phys.get("return_safety_factor", d.return_safety_factor)), "supuesto", phys_src),
            caution_margin_threshold=note("eva.caution_margin_threshold", float(phys.get("caution_margin_threshold", d.caution_margin_threshold)), "supuesto", phys_src),
            suit_leak_multiplier=note("scenario.suit_leak_multiplier", float(phys.get("suit_leak_multiplier", d.suit_leak_multiplier)), "supuesto", phys_src),
            injury_speed_multiplier=note("scenario.injury_speed_multiplier", float(phys.get("injury_speed_multiplier", d.injury_speed_multiplier)), "supuesto", phys_src),
            dust_storm_speed_factor=note("scenario.dust_storm_speed_factor", float(dust.get("dust_storm_speed_factor", d.dust_storm_speed_factor)), "supuesto", dust.get("source", "env.json → dust")),
            dose_msv_per_sol=note("radiation.gcr_dose_mSv_per_sol", float(rad.get("gcr_dose_mSv_per_sol", d.dose_msv_per_sol)), rad.get("kind_es", "medido"), rad.get("source", "MSL RAD")),
            sep_dose_rate_msv_per_h=note("radiation.sep_dose_rate_mSv_per_h", float(rad.get("solar_storm", {}).get("unshielded_dose_rate_mSv_per_hr", d.sep_dose_rate_msv_per_h)), "modelado", rad.get("solar_storm", {}).get("source", "DONKI")),
            eva_dose_budget_msv=note("radiation.eva_nominal_budget_mSv", float(rad.get("limits", {}).get("eva_nominal_budget_mSv", d.eva_dose_budget_msv)), "supuesto", rad.get("limits", {}).get("source", "NASA-STD-3001")),
            science_radius_m=note("eva.science_radius_m", float(mpe.get("science_radius_m", d.science_radius_m)), "supuesto", "mission_params.json"),
            nogo_dilation_cells=int(mpe.get("nogo_dilation_cells", d.nogo_dilation_cells)),
            slope_caution_deg=note("eva.slope_caution_deg", float(classes.get("caution", {}).get("min_deg", d.slope_caution_deg)), "supuesto", classes.get("source", "env.json → terrain_classes")),
            slope_nogo_deg=note("eva.slope_nogo_deg", float(classes.get("impassable", {}).get("min_deg", d.slope_nogo_deg)), "supuesto", classes.get("source", "env.json → terrain_classes")),
        )

        r = mp.get("rover", {})
        rd = RoverParams()
        rk = r.get("kind", {})
        rsrc = "mission_params.json → rover"

        def rk_of(field: str) -> str:
            return rk.get(field, rk.get("resto", "supuesto")) if isinstance(rk, dict) else "supuesto"

        slope = r.get("slope_classes", {})
        rover = RoverParams(
            name=r.get("name", rd.name),
            mass_kg=note("rover.mass_kg", float(r.get("mass_kg", rd.mass_kg)), rk_of("mass_kg"), rsrc),
            crr=note("rover.crr", float(r.get("crr", rd.crr)), rk_of("crr"), rsrc),
            drivetrain_eff=note("rover.drivetrain_eff", float(r.get("drivetrain_eff", rd.drivetrain_eff)), rk_of("drivetrain_eff"), rsrc),
            hotel_kw=note("rover.hotel_kW", float(r.get("hotel_kW", rd.hotel_kw)), rk_of("hotel_kW"), rsrc),
            battery_kwh=note("rover.battery_kWh", float(r.get("battery_kWh", rd.battery_kwh)), rk_of("battery_kWh"), rsrc),
            battery_reserve_fraction=note("rover.battery_reserve_fraction", float(r.get("battery_reserve_fraction", rd.battery_reserve_fraction)), "supuesto", rsrc),
            v_nominal_kmh=note("rover.v_nominal_kmh", float(r.get("v_nominal_kmh", rd.v_nominal_kmh)), rk_of("v_nominal_kmh"), rsrc),
            v_caution_kmh=note("rover.v_caution_kmh", float(r.get("v_caution_kmh", rd.v_caution_kmh)), rk_of("v_caution_kmh"), rsrc),
            v_max_kmh=note("rover.v_max_kmh", float(r.get("v_max_kmh", rd.v_max_kmh)), rk_of("v_max_kmh"), rsrc),
            w_risk=float(r.get("w_risk", rd.w_risk)),
            cabin_dose_factor=note("rover.cabin_dose_factor", float(r.get("cabin_dose_factor", rd.cabin_dose_factor)), "supuesto", rsrc),
            slope_caution_deg=note("rover.slope_caution_deg", float(slope.get("caution_min_deg", rd.slope_caution_deg)), rk_of("slope_classes"), rsrc),
            slope_nogo_deg=note("rover.slope_nogo_deg", float(slope.get("nogo_min_deg", rd.slope_nogo_deg)), rk_of("slope_classes"), rsrc),
            nogo_dilation_cells=int(r.get("nogo_dilation_cells", rd.nogo_dilation_cells)),
            no_night_drive=note("rover.no_night_drive", bool(r.get("no_night_drive", rd.no_night_drive)), "supuesto", rsrc),
            egress_min=note("rover.egress_min", float(r.get("egress_min", rd.egress_min)), "supuesto", rsrc),
            ingress_min=note("rover.ingress_min", float(r.get("ingress_min", rd.ingress_min)), "supuesto", rsrc),
        )

        t = env.get("time", {})
        ew = env.get("eva_window", {})
        wd = MissionWindow()
        window = MissionWindow(
            eva_start_h=note("window.eva_start", ltst_to_hours(ew["start"]) if "start" in ew else wd.eva_start_h, "modelado", "env.json → eva_window"),
            eva_end_h=note("window.eva_end", ltst_to_hours(ew["end"]) if "end" in ew else wd.eva_end_h, "modelado", "env.json → eva_window"),
            eva_max_duration_min=note("window.eva_max_duration_min", float(ew.get("max_duration_min", wd.eva_max_duration_min)), "modelado", "env.json → eva_window"),
            sunrise_h=note("window.sunrise", ltst_to_hours(t["sunrise"]) if "sunrise" in t else wd.sunrise_h, "modelado", t.get("source", "env.json → time")),
            sunset_h=note("window.sunset", ltst_to_hours(t["sunset"]) if "sunset" in t else wd.sunset_h, "modelado", t.get("source", "env.json → time")),
            sol=int(t.get("sol", wd.sol)),
        )

        ref = env.get("reference_eva", {}).get("profiles", {})
        mprof = mp.get("profiles", {})
        profiles: dict[RouteProfile, ProfileWeights] = {}
        for prof in RouteProfile:
            dflt = DEFAULT_PROFILES[prof]
            w_r = float(ref.get(prof.value, {}).get("w_risk", dflt.w_risk))
            w_s = float(mprof.get(prof.value, {}).get("w_science", dflt.w_science))
            profiles[prof] = ProfileWeights(w_risk=w_r, w_science=w_s)
            note(f"profile.{prof.value}", {"w_risk": w_r, "w_science": w_s}, "supuesto",
                 "env.json → reference_eva.profiles + mission_params.json")

        base = mp.get("base", {})
        base_ll = tuple(base.get("lonlat", [137.42009295, -4.59310427]))
        note("base.lonlat", list(base_ll), base.get("kind", "propuesta"), base.get("source", "Calef et al. 2015"))
        return MissionParams(base_lonlat=(float(base_ll[0]), float(base_ll[1])), eva=eva, rover=rover,
                             window=window, profiles=profiles, assumption_table=table)
