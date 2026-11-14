import pytest

from senda.application.use_cases.targets import GetTarget, ListTargets
from senda.domain.errors import TargetNotFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.target import Rubric, ScienceTarget


class FakeTargetRepository:
    """Adaptador falso: demuestra que el caso de uso no depende de JSON ni HTTP."""

    def __init__(self, items):
        self._items = {t.id: t for t in items}

    def list_all(self):
        return list(self._items.values())

    def get_by_id(self, target_id):
        return self._items.get(target_id)


def _target(tid):
    return ScienceTarget(tid, tid, GeoPoint(0, 0), 0.0, Rubric(1, 2, 3), "", "")


def test_list_is_sorted_by_id():
    repo = FakeTargetRepository([_target("T02"), _target("T01")])
    assert [t.id for t in ListTargets(repo).execute()] == ["T01", "T02"]


def test_get_missing_target_raises():
    with pytest.raises(TargetNotFound):
        GetTarget(FakeTargetRepository([])).execute("X")
