from fastapi import FastAPI

from app.core.config import settings
from app.routes.auth import router as auth_router

app = FastAPI(title=settings.app_name)

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "Backend running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}