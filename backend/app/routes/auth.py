from json import dumps
from urllib.parse import urlencode, quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.services.twitch_api import get_authenticated_user, get_user_clips
from app.services.twitch_auth import exchange_code_for_token

router = APIRouter(prefix="/auth", tags=["auth"])

TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
FRONTEND_CALLBACK_URL = "http://localhost:3000"


@router.get("/twitch/login")
def twitch_login():
    params = {
        "client_id": settings.twitch_client_id,
        "redirect_uri": settings.twitch_redirect_uri,
        "response_type": "code",
        "scope": "user:read:email",
    }

    auth_url = f"{TWITCH_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(auth_url)


@router.get("/twitch/callback")
def twitch_callback(code: str, first: int = Query(default=10, ge=1, le=20)):
    try:
        token_data = exchange_code_for_token(code)
        access_token = token_data["access_token"]

        user_data = get_authenticated_user(access_token)
        user = user_data.get("data", [{}])[0]

        broadcaster_id = user.get("id")
        if not broadcaster_id:
            raise HTTPException(
                status_code=400,
                detail="Unable to determine broadcaster ID",
            )

        clips_data = get_user_clips(
            access_token=access_token,
            broadcaster_id=broadcaster_id,
            first=first,
        )

        raw_clips = clips_data.get("data", [])

        clips = [
            {
                "id": clip.get("id"),
                "url": clip.get("url"),
                "embed_url": clip.get("embed_url"),
                "title": clip.get("title"),
                "creator_name": clip.get("creator_name"),
                "thumbnail_url": clip.get("thumbnail_url"),
                "view_count": clip.get("view_count"),
                "created_at": clip.get("created_at"),
                "duration": clip.get("duration"),
                "vod_offset": clip.get("vod_offset"),
            }
            for clip in raw_clips
        ]

        payload = {
            "message": "Twitch OAuth successful",
            "user": {
                "id": user.get("id"),
                "login": user.get("login"),
                "display_name": user.get("display_name"),
                "email": user.get("email"),
                "profile_image_url": user.get("profile_image_url"),
            },
            "clips": clips,
            "clip_count": len(clips),
            "token_type": token_data.get("token_type"),
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope", []),
        }

        encoded_payload = quote(dumps(payload))
        redirect_url = f"{FRONTEND_CALLBACK_URL}/?oauth=success&payload={encoded_payload}"
        return RedirectResponse(redirect_url)

    except Exception as exc:
        error_message = quote(str(exc))
        redirect_url = f"{FRONTEND_CALLBACK_URL}/?oauth=error&message={error_message}"
        return RedirectResponse(redirect_url)