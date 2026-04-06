import base64
import json
from pathlib import Path

import requests


DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_VISION_MODEL = "llava-llama3:8b"
OLLAMA_TIMEOUT_SECONDS = 120

VISION_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "scene_description": {"type": "string"},
        "visible_elements": {
            "type": "array",
            "items": {"type": "string"},
        },
        "possible_context_tags": {
            "type": "array",
            "items": {"type": "string"},
        },
        "visual_tone": {"type": "string"},
    },
    "required": [
        "scene_description",
        "visible_elements",
        "possible_context_tags",
        "visual_tone",
    ],
}


def _encode_image_to_base64(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def _build_vision_prompt() -> str:
    schema_text = json.dumps(VISION_OUTPUT_SCHEMA, ensure_ascii=False, indent=2)

    return f"""You are analyzing a single representative frame from a short-form gaming clip.

Your goal is to produce brief, grounded visual notes that can later help with title, hashtag, and summary generation.

Do:
- describe only what is visually apparent
- keep notes short and factual
- mention obvious UI/gameplay context only if clearly visible
- mention facecam presence only if clearly visible
- mention general mood/tone only if strongly implied visually

Do not:
- invent exact game titles unless clearly visible
- invent streamer identity
- invent events not visible in the frame
- over-interpret

Return valid JSON that matches this schema exactly:
{schema_text}
"""


def generate_vision_notes(
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
            "reason": f"Representative frame not found: {image_path}",
        }

    selected_model = model_name or DEFAULT_VISION_MODEL
    encoded_image = _encode_image_to_base64(image_file)
    prompt = _build_vision_prompt()

    response = requests.post(
        f"{ollama_url}/api/generate",
        json={
            "model": selected_model,
            "prompt": prompt,
            "images": [encoded_image],
            "format": VISION_OUTPUT_SCHEMA,
            "stream": False,
        },
        timeout=OLLAMA_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    response_json = response.json()
    raw_model_text = str(response_json.get("response", "")).strip()

    if not raw_model_text:
        raise ValueError("Empty response from vision model")

    try:
        parsed = json.loads(raw_model_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON object from vision response") from exc

    scene_description = parsed.get("scene_description")
    visible_elements = parsed.get("visible_elements")
    possible_context_tags = parsed.get("possible_context_tags")
    visual_tone = parsed.get("visual_tone")

    if not isinstance(scene_description, str):
        raise ValueError("Vision response missing valid scene_description")
    if not isinstance(visible_elements, list):
        raise ValueError("Vision response missing valid visible_elements list")
    if not isinstance(possible_context_tags, list):
        raise ValueError("Vision response missing valid possible_context_tags list")
    if not isinstance(visual_tone, str):
        raise ValueError("Vision response missing valid visual_tone")

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "notes": {
            "scene_description": scene_description.strip(),
            "visible_elements": [
                str(item).strip() for item in visible_elements if str(item).strip()
            ][:6],
            "possible_context_tags": [
                str(item).strip()
                for item in possible_context_tags
                if str(item).strip()
            ][:6],
            "visual_tone": visual_tone.strip(),
        },
    }