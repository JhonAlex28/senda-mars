class DomainError(Exception):
    """Error base del dominio."""


class TargetNotFound(DomainError):
    def __init__(self, target_id: str) -> None:
        super().__init__(f"Target '{target_id}' not found")
        self.target_id = target_id
