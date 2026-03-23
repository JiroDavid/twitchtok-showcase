import requests

from app.core.config import settings
from urllib.parse import urlparse

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


def get_user_clips(access_token: str, broadcaster_id: str, first: int = 10) -> dict:
    response = requests.get(
        f"{TWITCH_HELIX_BASE_URL}/clips",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Client-Id": settings.twitch_client_id,
        },
        params={
            "broadcaster_id": broadcaster_id,
            "first": first,
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()

def extract_clip_slug(clip_url: str) -> str:
    parsed = urlparse(clip_url)

    if parsed.netloc not in {
        "clips.twitch.tv",
        "www.twitch.tv",
        "twitch.tv",
    }:
        raise ValueError("Unsupported Twitch clip domain")

    path_parts = [part for part in parsed.path.split("/") if part]

    if parsed.netloc == "clips.twitch.tv":
        if not path_parts:
            raise ValueError("Invalid Twitch clip URL")
        return path_parts[0]

    if "clip" in path_parts:
        clip_index = path_parts.index("clip")
        if clip_index + 1 < len(path_parts):
            return path_parts[clip_index + 1]

    raise ValueError("Could not extract clip slug from URL")