from fastapi import APIRouter, HTTPException

from app.schemas.clips import ClipResolveRequest, ClipResolveResponse
from app.services.twitch_api import extract_clip_slug

router = APIRouter(prefix="/clips", tags=["clips"])


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