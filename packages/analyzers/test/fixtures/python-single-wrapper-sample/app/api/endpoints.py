from app.services.summarizer import summarize
from app.utils.text import clean


def router(text: str) -> str:
    return summarize(clean(text))
