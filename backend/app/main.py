from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.clips import router as clips_router
from app.routes.jobs import router as jobs_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://condiment-schnapps-paramedic.ngrok-free.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
DOWNLOADS_DIR = STORAGE_DIR / "downloads"
OUTPUTS_DIR = STORAGE_DIR / "outputs"

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/storage/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")
app.mount("/storage/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

app.include_router(auth_router)
app.include_router(clips_router)
app.include_router(jobs_router)


@app.get("/")
def root():
    return {"message": "Backend running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}