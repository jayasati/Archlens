from typing import Optional

from models.user import User


# Intentional god-class smell: many methods, broad responsibility.
class AuthService:
    def __init__(self):
        self.tokens = {}
        self.users = {}
        self.sessions = {}
        self.audit_log = []
        self.failed_attempts = {}

    def register(self, email: str, name: str) -> User:
        user_id = len(self.users) + 1
        user = User(id=user_id, email=email, name=name)
        self.users[user_id] = user
        return user

    def login(self, email: str, password: str) -> Optional[str]:
        for user in self.users.values():
            if user.email == email:
                token = f"token-{user.id}"
                self.tokens[token] = user.id
                return token
        return None

    def logout(self, token: str) -> bool:
        if token in self.tokens:
            del self.tokens[token]
            return True
        return False

    def verify(self, token: str) -> Optional[User]:
        user_id = self.tokens.get(token)
        if user_id is None:
            return None
        return self.users.get(user_id)

    def reset_password(self, email: str) -> bool:
        for user in self.users.values():
            if user.email == email:
                self.audit_log.append(f"reset:{user.id}")
                return True
        return False

    def change_email(self, user_id: int, new_email: str) -> bool:
        user = self.users.get(user_id)
        if user is None:
            return False
        user.email = new_email
        return True

    def deactivate(self, user_id: int) -> bool:
        user = self.users.get(user_id)
        if user is None:
            return False
        user.is_active = False
        return True

    def reactivate(self, user_id: int) -> bool:
        user = self.users.get(user_id)
        if user is None:
            return False
        user.is_active = True
        return True

    def record_failed_attempt(self, email: str) -> None:
        self.failed_attempts[email] = self.failed_attempts.get(email, 0) + 1

    def is_locked(self, email: str) -> bool:
        return self.failed_attempts.get(email, 0) >= 5

    def grant_session(self, user_id: int, session_id: str) -> None:
        self.sessions[session_id] = user_id

    def revoke_session(self, session_id: str) -> bool:
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def list_users(self):
        return list(self.users.values())
