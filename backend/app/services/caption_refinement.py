import json
from pathlib import Path

import requests


DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_REFINEMENT_MODEL = "llama3.1:8b"
OLLAMA_TIMEOUT_SECONDS = 120


def _extract_first_json_object(text: str) -> dict:
    text = text.strip()

    if not text:
        raise ValueError("Empty response from refinement model")

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start_index = text.find("{")
    if start_index == -1:
        raise ValueError("No JSON object found in refinement response")

    depth = 0
    for index in range(start_index, len(text)):
        char = text[index]

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1

            if depth == 0:
                candidate = text[start_index : index + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        "Failed to parse JSON object from refinement response"
                    ) from exc

    raise ValueError("Could not extract a complete JSON object from refinement response")


def _build_refinement_prompt(captions: list[dict]) -> str:
    serializable_captions = [
        {
            "id": caption["id"],
            "raw_text": caption["raw_text"],
            "start": caption["start"],
            "end": caption["end"],
        }
        for caption in captions
    ]

    captions_json = json.dumps(serializable_captions, ensure_ascii=False, indent=2)

    return f"""You are refining draft subtitles for short-form creator content.

Your goal is to make captions slightly easier to read while staying extremely faithful to what was actually said.

Allowed changes:
- fix capitalization
- fix punctuation
- make very small readability improvements
- make very small grammar cleanups only when the intended meaning is obvious
- keep slang, tone, and informal speech when possible

Do not:
- invent new words
- add context that was not spoken
- rewrite aggressively
- merge or split captions
- change ids
- change timestamps
- sanitize or formalize streamer language too much

Important rule:
If the caption is ambiguous or uncertain, return it unchanged.

Return JSON only in exactly this shape:
{{
  "captions": [
    {{
      "id": 1,
      "refined_text": "..."
    }}
  ]
}}

Input captions:
{captions_json}
"""


def refine_captions_json(
    captions_json_path: str,
    model_name: str | None = None,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> dict:
    json_file = Path(captions_json_path)

    if not json_file.exists():
        raise FileNotFoundError(f"Captions JSON not found: {captions_json_path}")

    payload = json.loads(json_file.read_text(encoding="utf-8"))
    captions = payload.get("captions") or []

    if not captions:
        payload["refinement"] = {
            "applied": False,
            "model": model_name or DEFAULT_REFINEMENT_MODEL,
            "refined_count": 0,
            "reason": "No captions available to refine",
        }
        json_file.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return payload["refinement"]

    selected_model = model_name or DEFAULT_REFINEMENT_MODEL
    prompt = _build_refinement_prompt(captions)

    response = requests.post(
        f"{ollama_url}/api/generate",
        json={
            "model": selected_model,
            "prompt": prompt,
            "stream": False,
        },
        timeout=OLLAMA_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    response_json = response.json()
    raw_model_text = str(response_json.get("response", "")).strip()

    parsed = _extract_first_json_object(raw_model_text)
    refined_items = parsed.get("captions")

    if not isinstance(refined_items, list):
        raise ValueError("Refinement response JSON did not contain a valid 'captions' list")

    refined_map: dict[int, str] = {}
    for item in refined_items:
        if not isinstance(item, dict):
            continue

        caption_id = item.get("id")
        refined_text = item.get("refined_text")

        if not isinstance(caption_id, int):
            continue
        if not isinstance(refined_text, str):
            continue

        refined_map[caption_id] = refined_text.strip()

    refined_count = 0

    for caption in captions:
        caption_id = caption.get("id")
        raw_text = str(caption.get("raw_text", "")).strip()
        refined_text = refined_map.get(caption_id, "").strip()

        if refined_text and refined_text != raw_text:
            caption["refined_text"] = refined_text
            caption["refinement_source"] = f"ollama:{selected_model}"
            caption["status"] = "ai_refined"
            refined_count += 1
        else:
            caption["refined_text"] = None
            caption["refinement_source"] = None
            caption["status"] = "draft"

        caption["final_text"] = raw_text

    payload["refinement"] = {
        "applied": True,
        "model": selected_model,
        "refined_count": refined_count,
        "total_captions": len(captions),
    }

    json_file.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return payload["refinement"]