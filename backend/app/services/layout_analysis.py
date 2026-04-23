import base64
import json
from pathlib import Path

import requests

from app.services.vision_analysis import DEFAULT_OLLAMA_URL, DEFAULT_VISION_MODEL, OLLAMA_TIMEOUT_SECONDS

SOURCE_WIDTH = 1920
SOURCE_HEIGHT = 1080

# Regions smaller than this in either dimension are rejected as implausible.
MIN_REGION_WIDTH = 50
MIN_REGION_HEIGHT = 50

# If every coordinate value in a region is <= this threshold it's almost certainly
# a 0-100 percentage rather than a pixel value.
PERCENTAGE_DETECTION_THRESHOLD = 100

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

STACKED_CROP_PROMPT = f"""You are analysing a single frame from a 1920×1080 gaming stream clip.

The user wants to export this clip as a stacked vertical video (9:16, 1080×1920) with two regions:
- TOP region: the streamer's facecam / webcam overlay
- BOTTOM region: the main gameplay area

Your job is to locate these two regions in the source frame.

IMPORTANT — coordinate system:
- The source frame is exactly {SOURCE_WIDTH} pixels wide and {SOURCE_HEIGHT} pixels tall.
- All values (x, y, w, h) MUST be raw PIXEL counts, NOT percentages or normalised values.
- Valid ranges: x in [0, {SOURCE_WIDTH}), y in [0, {SOURCE_HEIGHT}), w in [1, {SOURCE_WIDTH}], h in [1, {SOURCE_HEIGHT}].
- A typical facecam overlay is 150–450 px wide and 120–380 px tall — look carefully at the actual frame.
- The gameplay area is usually at least 800 px wide and 400 px tall.
- Do NOT copy example values — every stream layout is different; measure what you actually see.

Instructions:
- Identify the bounding box of the facecam/webcam overlay (usually a small inset in one of the four corners).
- Identify the bounding box of the primary gameplay content (usually most of the frame).
- If no distinct facecam is visible, use a fallback facecam centred at the top (x={SOURCE_WIDTH//2 - 300} y=0 w=600 h=300) and full frame as gameplay.
- detection_notes must state which corner the facecam is in and confirm all values are in pixels.

Return valid JSON only — no markdown, no explanation:
{{
  "facecam_region": {{"x": int, "y": int, "w": int, "h": int}},
  "gameplay_region": {{"x": int, "y": int, "w": int, "h": int}},
  "detection_notes": "one or two sentences"
}}
"""


def _encode_image_to_base64(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def _looks_like_percentages(box: dict) -> bool:
    """Return True if all four values are in 0-100 range, suggesting the model
    returned percentages instead of pixel coordinates."""
    return all(0 <= box[k] <= PERCENTAGE_DETECTION_THRESHOLD for k in ("x", "y", "w", "h"))


def _scale_percentages_to_pixels(box: dict) -> dict:
    return {
        "x": int(round(box["x"] / 100 * SOURCE_WIDTH)),
        "y": int(round(box["y"] / 100 * SOURCE_HEIGHT)),
        "w": int(round(box["w"] / 100 * SOURCE_WIDTH)),
        "h": int(round(box["h"] / 100 * SOURCE_HEIGHT)),
    }


def _clamp_to_frame(box: dict) -> dict:
    x = max(0, min(box["x"], SOURCE_WIDTH - 1))
    y = max(0, min(box["y"], SOURCE_HEIGHT - 1))
    w = max(1, min(box["w"], SOURCE_WIDTH - x))
    h = max(1, min(box["h"], SOURCE_HEIGHT - y))
    return {"x": x, "y": y, "w": w, "h": h}


def _exclude_facecam_from_gameplay(gameplay: dict, facecam: dict) -> dict:
    """Shift the gameplay crop horizontally to avoid the facecam corner.

    Only adjusts x/w — trimming height would chop off too much gameplay content.
    Falls back to the original box if the result would be narrower than 600px.
    """
    facecam_center_x = facecam["x"] + facecam["w"] / 2
    gx, gy, gw, gh = gameplay["x"], gameplay["y"], gameplay["w"], gameplay["h"]

    if facecam_center_x < SOURCE_WIDTH / 2:
        # Facecam on the left — shift gameplay start right past facecam edge
        new_x = facecam["x"] + facecam["w"]
        new_w = gw - (new_x - gx)
    else:
        # Facecam on the right — cap gameplay width at facecam left edge
        new_x = gx
        new_w = facecam["x"] - gx

    if new_w < 600:
        return gameplay

    return _clamp_to_frame({"x": new_x, "y": gy, "w": new_w, "h": gh})


def _parse_crop_hint(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None

    try:
        box = {
            "x": int(raw.get("x", 0)),
            "y": int(raw.get("y", 0)),
            "w": int(raw.get("w", 0)),
            "h": int(raw.get("h", 0)),
        }
    except (TypeError, ValueError):
        return None

    if _looks_like_percentages(box):
        box = _scale_percentages_to_pixels(box)

    box = _clamp_to_frame(box)

    if box["w"] < MIN_REGION_WIDTH or box["h"] < MIN_REGION_HEIGHT:
        return None

    return box


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

    if top_crop_hint and bottom_crop_hint:
        bottom_crop_hint = _exclude_facecam_from_gameplay(bottom_crop_hint, top_crop_hint)

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "reasoning": detection_notes,
        "top_crop_hint": top_crop_hint,
        "bottom_crop_hint": bottom_crop_hint,
    }
