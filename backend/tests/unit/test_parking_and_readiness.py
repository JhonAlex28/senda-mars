from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.geo import GeoPoint
from senda.domain.models.target import Rubric, ScienceTarget
from senda.domain.services.parking import group_by_walking_zone
from senda.domain.services.readiness import Verdict, assess


def _target(tid: str, lon: float) -> ScienceTarget:
    return ScienceTarget(tid, tid, GeoPoint(lon, 0.0), 0.0, Rubric(1, 1, 1), "", "")


def test_targets_are_grouped_by_walking_distance_in_priority_order():
    # 0.001° de longitud ≈ 59 m en el ecuador marciano
    near_a, near_b, far = _target("A", 0.0), _target("B", 0.002), _target("C", 0.05)
    zones = group_by_walking_zone([far, near_a, near_b])
    assert [[t.id for t in z] for z in zones] == [["C"], ["A", "B"]]


def _env(**blocks) -> EnvironmentSnapshot:
    return EnvironmentSnapshot(5074, 21.8, "09:30", 745, -76, -12, details=blocks)


def test_good_weather_is_go():
    env = _env(temperature={"eva_window_mean_C": -23}, atmosphere={"wind_speed_m_s": 4},
               dust={"optical_depth_tau": 0.45}, radiation={"gcr_dose_mSv_per_sol": 0.6})
    assert assess(env).verdict is Verdict.GO


def test_dust_storm_is_no_go():
    env = _env(temperature={"eva_window_mean_C": -23}, dust={"optical_depth_tau": 4.0})
    readiness = assess(env)
    assert readiness.verdict is Verdict.NO_GO
    assert next(c for c in readiness.checks if c.key == "dust").verdict is Verdict.NO_GO


def test_order_tour_avoids_zig_zag_and_renumbers():
    from senda.domain.models.geo import GeoPoint
    from senda.domain.models.route import ParkingSpot
    from senda.domain.services.parking import order_tour

    base = GeoPoint(137.42, -4.59)
    far, mid, near = (ParkingSpot(i, GeoPoint(137.42, lat), [t])
                      for i, lat, t in (("A", -4.80, "a"), ("B", -4.70, "b"), ("C", -4.60, "c")))
    tour = order_tour(base, [far, near, mid])          # orden de prioridad: ida y vuelta 2 veces
    assert [p.target_ids for p in tour] in ([["c"], ["b"], ["a"]], [["a"], ["b"], ["c"]])
    assert [p.id for p in tour] == ["P1", "P2", "P3"]
