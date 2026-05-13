from app.api.endpoints import router
from app.core.config import get_settings


def create_app():
    settings = get_settings()
    return {"router": router, "settings": settings}
