from __future__ import annotations

from senda.application.ports.outbound import EnvironmentRepository
from senda.domain.models.environment import EnvironmentSnapshot


class GetEnvironment:
    def __init__(self, repo: EnvironmentRepository) -> None:
        self._repo = repo

    def execute(self) -> EnvironmentSnapshot:
        return self._repo.get_current()
