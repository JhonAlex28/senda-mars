from __future__ import annotations

from senda.application.ports.outbound import TargetRepository
from senda.domain.errors import TargetNotFound
from senda.domain.models.target import ScienceTarget


class ListTargets:
    def __init__(self, repo: TargetRepository) -> None:
        self._repo = repo

    def execute(self) -> list[ScienceTarget]:
        return sorted(self._repo.list_all(), key=lambda t: t.id)


class GetTarget:
    def __init__(self, repo: TargetRepository) -> None:
        self._repo = repo

    def execute(self, target_id: str) -> ScienceTarget:
        target = self._repo.get_by_id(target_id)
        if target is None:
            raise TargetNotFound(target_id)
        return target
