from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.clips import (
    ClipDownloadRequest,
    ClipDownloadResponse,
    ClipResolveRequest,
    ClipResolveResponse,
)
from app.services.twitch_api import download_twitch_clip, extract_clip_slug

router = APIRouter(prefix="/clips", tags=["clips"])

DOWNLOADS_DIR = Path("storage/downloads")


@router.get("/downloaded")
def list_downloaded_clips():
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    for file_path in sorted(DOWNLOADS_DIR.glob("*.mp4")):
        files.append(
            {
                "filename": file_path.name,
                "download_path": str(file_path),
                "url": f"/storage/downloads/{file_path.name}",
            }
        )

    return {"clips": files, "count": len(files)}


@router.post("/resolve", response_model=ClipResolveResponse)
def resolve_clip_url(payload: ClipResolveRequest):
    try:
        clip_slug = extract_clip_slug(str(payload.clip_url))
        return ClipResolveResponse(
            original_url=str(payload.clip_url),
            clip_slug=clip_slug,
            source_type="twitch_clip",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/download", response_model=ClipDownloadResponse)
def download_clip(payload: ClipDownloadRequest):
    try:
        clip_url = str(payload.clip_url)
        clip_slug = extract_clip_slug(clip_url)

        result = download_twitch_clip(clip_url=clip_url, clip_slug=clip_slug)

        return ClipDownloadResponse(
            original_url=clip_url,
            clip_slug=clip_slug,
            download_path=result["download_path"],
            filename=result["filename"],
            source_type="twitch_clip",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))