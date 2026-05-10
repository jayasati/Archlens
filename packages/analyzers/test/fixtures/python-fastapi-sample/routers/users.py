from fastapi import APIRouter

from models.user import User
from services.auth import AuthService

router = APIRouter(prefix="/users", tags=["users"])
auth = AuthService()


@router.get("/")
def list_users():
    return [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]


@router.get("/{user_id}")
def get_user(user_id: int):
    if user_id <= 0:
        return {"error": "invalid id"}
    return {"id": user_id, "name": "user"}


# Intentional long-method smell: lots of branches, deep nesting, > 30 LOC.
@router.post("/{user_id}/complex-update")
def complex_update(user_id: int, payload: dict, token: str):
    user = auth.verify(token)
    if user is None:
        return {"error": "unauthorized"}
    if user_id <= 0:
        return {"error": "bad id"}
    if "name" in payload:
        name = payload["name"]
        if isinstance(name, str):
            if len(name) > 0:
                if len(name) < 100:
                    if name.isascii():
                        if not name.startswith(" "):
                            cleaned = name.strip()
                        else:
                            cleaned = name
                    else:
                        cleaned = name.encode("ascii", "ignore").decode()
                else:
                    cleaned = name[:100]
            else:
                cleaned = "anonymous"
        else:
            cleaned = str(name)
    else:
        cleaned = "anonymous"
    if "email" in payload and "@" in payload["email"]:
        email = payload["email"].lower()
    else:
        email = None
    if "active" in payload and payload["active"] is True:
        active = True
    else:
        active = False
    if "tags" in payload:
        tags = []
        for tag in payload["tags"]:
            if isinstance(tag, str) and len(tag) > 0:
                tags.append(tag.lower())
    else:
        tags = []
    result = {"id": user_id, "name": cleaned, "email": email, "active": active, "tags": tags}
    if cleaned == "anonymous":
        result["warning"] = "fallback name used"
    return result
