from dataclasses import dataclass


@dataclass
class User:
    id: int
    email: str
    name: str
    is_active: bool = True

    def display_name(self) -> str:
        return self.name or self.email
