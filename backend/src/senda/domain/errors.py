class DomainError(Exception):
    """Error base del dominio."""


class TargetNotFound(DomainError):
    def __init__(self, target_id: str) -> None:
        super().__init__(f"Target '{target_id}' not found")
        self.target_id = target_id


class NoRouteFound(DomainError):
    def __init__(self, detail: str) -> None:
        super().__init__(f"No passable route: {detail}")


class OutsideSite(DomainError):
    def __init__(self, lon: float, lat: float) -> None:
        super().__init__(f"Point ({lon:.5f}, {lat:.5f}) is outside the mission area (terrain grids)")


class InvalidRequest(DomainError):
    pass


class AssistantUnavailable(DomainError):
    def __init__(self, detail: str) -> None:
        super().__init__(f"Assistant unavailable: {detail}")
