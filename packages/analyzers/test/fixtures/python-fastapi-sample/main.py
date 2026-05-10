from fastapi import FastAPI

from routers import users
from services.auth import AuthService

app = FastAPI(title="Sample FastAPI app")
auth = AuthService()

app.include_router(users.router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/me")
def me(token: str):
    user = auth.verify(token)
    if user is None:
        return {"error": "unauthorized"}
    return {"user": user}
