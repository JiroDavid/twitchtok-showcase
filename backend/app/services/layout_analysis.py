import base64
import json
from pathlib import Path

import requests

from app.services.vision_analysis import DEFAULT_OLLAMA_URL, DEFAULT_VISION_MODEL, OLLAMA_TIMEOUT_SECONDS

STACKED_CROP_SCHEMA = {
    "type": "object",
    "properties": {
        "facecam_region": {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "w": {"type": "integer"},
                "h": {"type": "integer"},
            },
            "required": ["x", "y", "w", "h"],
        },
        "gameplay_region": {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "w": {"type": "integer"},
                "h": {"type": "integer"},
            },
            "required": ["x", "y", "w", "h"],
        },
        "detection_notes": {"type": "string"},
    },
    "required": ["facecam_region", "gameplay_region", "detection_notes"],
}

STACKED_CROP_PROMPT = """You are analysing a single frame from a 1920×1080 gaming stream clip.

The user wants to export this clip as a stacked vertical video (9:16, 1080×1920) with two regions:
- TOP region: the streamer's facecam / webcam overlay
- BOTTOM region: the main gameplay area

Your job is to locate these two regions in the source frame. The source frame is always 1920×1080 pixels.

Instructions:
- Identify the bounding box of the facecam/webcam overlay (usually a small inset in a corner).
- Identify the bounding box of the primary gameplay content (usually the majority of the frame, excluding the facecam).
- Return pixel coordinates as integers (x, y = top-left corner; w = width; h = height).
- If no distinct facecam is visible, use the top-centre area as a fallback facecam region and the full frame as gameplay.
- detection_notes should describe where you found each region (e.g. "Facecam in top-right corner, ~200×200px. Gameplay occupies full width below.").

Return valid JSON only:
{
  "facecam_region": {"x": int, "y": int, "w": int, "h": int},
  "gameplay_region": {"x": int, "y": int, "w": int, "h": int},
  "detection_notes": "one or two sentences describing what was detected"
}
"""


def _encode_image_to_base64(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def _parse_crop_hint(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None

    try:
        return {
            "x": int(raw.get("x", 0)),
            "y": int(raw.get("y", 0)),
            "w": int(raw.get("w", 0)),
            "h": int(raw.get("h", 0)),
        }
    except (TypeError, ValueError):
        return None


def analyze_video_layout(
    image_path: str,
    model_name: str | None = None,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> dict:
    image_file = Path(image_path)

    if not image_file.exists():
        return {
            "applied": False,
            "status": "skipped",
            "model": model_name or DEFAULT_VISION_MODEL,
            "reason": f"Frame not found: {image_path}",
            "reasoning": None,
            "top_crop_hint": None,
            "bottom_crop_hint": None,
        }

    selected_model = model_name or DEFAULT_VISION_MODEL
    encoded_image = _encode_image_to_base64(image_file)

    response = requests.post(
        f"{ollama_url}/api/generate",
        json={
            "model": selected_model,
            "prompt": STACKED_CROP_PROMPT,
            "images": [encoded_image],
            "format": STACKED_CROP_SCHEMA,
            "stream": False,
        },
        timeout=OLLAMA_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    response_json = response.json()
    raw_text = str(response_json.get("response", "")).strip()

    if not raw_text:
        raise ValueError("Empty response from stacked crop detection model")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON from stacked crop detection response") from exc

    detection_notes = str(parsed.get("detection_notes", "")).strip()
    top_crop_hint = _parse_crop_hint(parsed.get("facecam_region"))
    bottom_crop_hint = _parse_crop_hint(parsed.get("gameplay_region"))

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "reasoning": detection_notes,
        "top_crop_hint": top_crop_hint,
        "bottom_crop_hint": bottom_crop_hint,
    }
