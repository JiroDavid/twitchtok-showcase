from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.services.twitch_auth import exchange_code_for_token

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
    try:
        token_data = exchange_code_for_token(code)
        return {
            "message": "Twitch OAuth successful",
            "access_token_preview": token_data["access_token"][:10] + "...",
            "refresh_token_received": "refresh_token" in token_data,
            "scope": token_data.get("scope", []),
            "token_type": token_data.get("token_type"),
            "expires_in": token_data.get("expires_in"),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))