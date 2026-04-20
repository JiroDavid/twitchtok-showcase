import base64
import json
from pathlib import Path

import requests

from app.services.vision_analysis import DEFAULT_OLLAMA_URL, DEFAULT_VISION_MODEL, OLLAMA_TIMEOUT_SECONDS

LAYOUT_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "suggested_layout": {"type": "string", "enum": ["cropped", "fullscreen", "stacked"]},
        "confidence": {"type": "number"},
        "reasoning": {"type": "string"},
        "top_crop_hint": {
            "type": ["object", "null"],
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "w": {"type": "integer"},
                "h": {"type": "integer"},
            },
        },
        "bottom_crop_hint": {
            "type": ["object", "null"],
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "w": {"type": "integer"},
                "h": {"type": "integer"},
            },
        },
    },
    "required": ["suggested_layout", "confidence", "reasoning"],
}

LAYOUT_ANALYSIS_PROMPT = """You are a vertical short-form video layout expert (9:16, 1080×1920 output).

Analyze this frame from a 1920×1080 gaming/streaming clip and recommend the best layout for converting it to vertical format.

Layouts:
- "cropped": Crop one 9:16 region from the landscape frame. Best when the main action fits within a single vertical crop.
- "fullscreen": Letterbox/scale the full 16:9 frame into vertical space. Best for cinematic or wide content where cropping loses important context.
- "stacked": Split the vertical output into a top section (e.g. facecam) and a bottom section (e.g. gameplay). Best when there is a distinct webcam overlay alongside gameplay content.

Return valid JSON matching this schema:
{
  "suggested_layout": "cropped" | "fullscreen" | "stacked",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief one-sentence explanation",
  "top_crop_hint": {"x": int, "y": int, "w": int, "h": int} | null,
  "bottom_crop_hint": {"x": int, "y": int, "w": int, "h": int} | null
}

Provide top_crop_hint and bottom_crop_hint only when suggesting "stacked". Coordinates are in source 1920×1080 pixels.
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
            "suggested_layout": None,
            "confidence": None,
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
            "prompt": LAYOUT_ANALYSIS_PROMPT,
            "images": [encoded_image],
            "format": LAYOUT_ANALYSIS_SCHEMA,
            "stream": False,
        },
        timeout=OLLAMA_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    response_json = response.json()
    raw_text = str(response_json.get("response", "")).strip()

    if not raw_text:
        raise ValueError("Empty response from layout analysis model")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON from layout analysis response") from exc

    suggested_layout = parsed.get("suggested_layout")
    if suggested_layout not in ("cropped", "fullscreen", "stacked"):
        raise ValueError(f"Invalid suggested_layout value: {suggested_layout!r}")

    confidence_raw = parsed.get("confidence")
    try:
        confidence = float(confidence_raw) if confidence_raw is not None else 0.0
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.0

    reasoning = str(parsed.get("reasoning", "")).strip()
    top_crop_hint = _parse_crop_hint(parsed.get("top_crop_hint"))
    bottom_crop_hint = _parse_crop_hint(parsed.get("bottom_crop_hint"))

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "suggested_layout": suggested_layout,
        "confidence": confidence,
        "reasoning": reasoning,
        "top_crop_hint": top_crop_hint,
        "bottom_crop_hint": bottom_crop_hint,
    }
