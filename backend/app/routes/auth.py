from urllib.parse import urlencode

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"


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
def twitch_callback(code: str):
    return {
        "message": "Twitch OAuth callback received",
        "code": code,
    }