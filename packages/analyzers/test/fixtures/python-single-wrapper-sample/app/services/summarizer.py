from app.core.config import get_settings


def summarize(text: str) -> str:
    settings = get_settings()
    limit = settings["max_tokens"]
    return text[:limit]
