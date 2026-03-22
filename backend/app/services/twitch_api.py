import requests

from app.core.config import settings

TWITCH_HELIX_BASE_URL = "https://api.twitch.tv/helix"


def get_authenticated_user(access_token: str) -> dict:
    response = requests.get(
        f"{TWITCH_HELIX_BASE_URL}/users",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Client-Id": settings.twitch_client_id,
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()