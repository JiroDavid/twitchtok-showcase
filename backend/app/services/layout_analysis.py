import base64
import json
from pathlib import Path

import requests

from app.services.vision_analysis import DEFAULT_OLLAMA_URL, DEFAULT_VISION_MODEL, OLLAMA_TIMEOUT_SECONDS

SOURCE_WIDTH = 1920
SOURCE_HEIGHT = 1080

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

STACKED_CROP_PROMPT = f"""You are analysing a single frame from a 1920×1080 stream clip.

The user wants to export this clip as a stacked vertical video (9:16, 1080×1920) with two regions:
- TOP region: the streamer's webcam / facecam (a live video feed showing a real human face)
- BOTTOM region: the main content area (gameplay, screen share, IRL footage, etc.)

Your job is to locate these two regions in the source frame.

What a facecam looks like:
- A rectangular window showing a real human face, usually the streamer
- Typically overlaid in one of the four corners of the frame
- Looks like a live webcam feed — NOT a minimap, chat box, game UI, health bar, or any other overlay
- If you cannot see a real human face in a webcam-style window, there is NO facecam

IMPORTANT — coordinate system:
- The source frame is exactly {SOURCE_WIDTH} pixels wide and {SOURCE_HEIGHT} pixels tall.
- (x, y) is the TOP-LEFT corner of the region. (x + w, y + h) is the BOTTOM-RIGHT corner.
- All values MUST be raw PIXEL counts — do NOT use percentages or normalised values.
- Valid ranges: x in [0, {SOURCE_WIDTH-1}], y in [0, {SOURCE_HEIGHT-1}], w in [100, {SOURCE_WIDTH}], h in [80, {SOURCE_HEIGHT}].
- Do NOT return zeros or tiny values. Every field must be a realistic pixel measurement.

Instructions:
- Look for a real human face in a webcam window. If found, measure its bounding box tightly.
- If NO human face / webcam is visible, use the fallback: x={SOURCE_WIDTH//2 - 300} y=0 w=600 h=300 for facecam.
- For the content region, measure the primary content area. If it fills the whole frame use x=0 y=0 w={SOURCE_WIDTH} h={SOURCE_HEIGHT}.
- detection_notes must say which corner the facecam is in and whether it shows a real face, or state "no facecam detected".

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
    facecam_center_x = facecam["x"] + facecam["w"] / 2
    gx, gy, gw, gh = gameplay["x"], gameplay["y"], gameplay["w"], gameplay["h"]

    if facecam_center_x < SOURCE_WIDTH / 2:
        new_x = facecam["x"] + facecam["w"]
        new_w = gw - (new_x - gx)
    else:
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

    if not top_crop_hint:
        top_crop_hint = {
            "x": SOURCE_WIDTH // 2 - 300,
            "y": 0,
            "w": 600,
            "h": 300,
        }
        detection_notes = (detection_notes + " (facecam fallback applied)").strip()

    if not bottom_crop_hint:
        bottom_crop_hint = {
            "x": 0,
            "y": 0,
            "w": SOURCE_WIDTH,
            "h": SOURCE_HEIGHT,
        }
        detection_notes = (detection_notes + " (gameplay fallback applied)").strip()

    bottom_crop_hint = _exclude_facecam_from_gameplay(bottom_crop_hint, top_crop_hint)

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "reasoning": detection_notes,
        "top_crop_hint": top_crop_hint,
        "bottom_crop_hint": bottom_crop_hint,
    }
