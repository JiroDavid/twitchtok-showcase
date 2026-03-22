import requests

from app.core.config import settings

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"


def exchange_code_for_token(code: str) -> dict:
    response = requests.post(
        TWITCH_TOKEN_URL,
        data={
            "client_id": settings.twitch_client_id,
            "client_secret": settings.twitch_client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.twitch_redirect_uri,
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()