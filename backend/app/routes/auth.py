from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.services.twitch_api import get_authenticated_user
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
        access_token = token_data["access_token"]

        user_data = get_authenticated_user(access_token)

        user = user_data.get("data", [{}])[0]

        return {
            "message": "Twitch OAuth successful",
            "user": {
                "id": user.get("id"),
                "login": user.get("login"),
                "display_name": user.get("display_name"),
                "email": user.get("email"),
                "profile_image_url": user.get("profile_image_url"),
            },
            "token_type": token_data.get("token_type"),
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope", []),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))