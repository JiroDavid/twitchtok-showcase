import json
from pathlib import Path

import requests


DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_METADATA_MODEL = "llama3.1:8b"
OLLAMA_TIMEOUT_SECONDS = 120


def _extract_first_json_object(text: str) -> dict:
    text = text.strip()

    if not text:
        raise ValueError("Empty response from metadata generation model")

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start_index = text.find("{")
    if start_index == -1:
        raise ValueError("No JSON object found in metadata generation response")

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
                        "Failed to parse JSON object from metadata generation response"
                    ) from exc

    raise ValueError("Could not extract a complete JSON object from metadata generation response")


def _load_caption_text_from_metadata(metadata_payload: dict) -> str:
    captions_info = metadata_payload.get("captions") or {}
    captions_json_path = captions_info.get("captions_json_path")

    if not captions_json_path:
        return ""

    json_file = Path(captions_json_path)
    if not json_file.exists():
        return ""

    payload = json.loads(json_file.read_text(encoding="utf-8"))
    captions = payload.get("captions") or []

    lines: list[str] = []
    for caption in captions:
        final_text = str(caption.get("final_text") or "").strip()
        refined_text = str(caption.get("refined_text") or "").strip()
        raw_text = str(caption.get("raw_text") or "").strip()

        text = final_text or refined_text or raw_text
        if text:
            lines.append(text)

    return " ".join(lines).strip()


def _build_metadata_prompt(metadata_payload: dict, transcript_text: str) -> str:
    render = metadata_payload.get("render") or {}
    representative_frame = metadata_payload.get("representative_frame") or {}
    vision = metadata_payload.get("vision") or {}
    vision_notes = vision.get("notes") or {}

    compact_context = {
        "layout": render.get("layout"),
        "output_filename": render.get("output_filename"),
        "frame_filename": representative_frame.get("frame_filename"),
        "transcript_text": transcript_text,
        "vision_notes": vision_notes,
    }

    context_json = json.dumps(compact_context, ensure_ascii=False, indent=2)

    return f"""You are helping generate draft metadata for a short-form vertical video clip intended for TikTok and YouTube Shorts.

Your task is to produce:
- 3 short title suggestions
- 10 hashtag suggestions
- 1 short summary

Rules:
- Stay grounded primarily in the provided transcript text
- Use vision notes only as light supporting context
- Do not invent specific game details, names, or events unless clearly supported
- Titles should be punchy, attention-grabbing, and suitable for TikTok — use natural hype language, rhetorical questions, or reaction phrasing (e.g. "this clip is INSANE", "wait for it...", "no way this happened")
- Hashtags must follow TikTok convention: always include discovery tags (fyp, foryou, foryoupage) and platform tags (twitch, twitchclips, twitchstreams, gaming), then add 4-5 clip-specific tags based on what happened. All lowercase, no spaces, no # symbol in the returned strings.
- Summary should be 1 to 2 sentences max, written as a plain description of what happened
- If the context is weak, stay generic rather than hallucinating

Return JSON only in exactly this shape:
{{
  "title_suggestions": ["...", "...", "..."],
  "hashtag_suggestions": ["fyp", "twitch", "..."],
  "summary": "..."
}}

Context:
{context_json}
"""


def generate_metadata_suggestions(
    metadata_payload: dict,
    model_name: str | None = None,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> dict:
    transcript_text = _load_caption_text_from_metadata(metadata_payload)

    if not transcript_text:
        return {
            "applied": False,
            "status": "skipped",
            "model": model_name or DEFAULT_METADATA_MODEL,
            "reason": "No captions transcript available for metadata generation",
        }

    selected_model = model_name or DEFAULT_METADATA_MODEL
    prompt = _build_metadata_prompt(metadata_payload, transcript_text)

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

    title_suggestions = parsed.get("title_suggestions")
    hashtag_suggestions = parsed.get("hashtag_suggestions")
    summary = parsed.get("summary")

    if not isinstance(title_suggestions, list):
        raise ValueError("Metadata response missing valid title_suggestions list")
    if not isinstance(hashtag_suggestions, list):
        raise ValueError("Metadata response missing valid hashtag_suggestions list")
    if not isinstance(summary, str):
        raise ValueError("Metadata response missing valid summary string")

    clean_titles = [
        str(item).strip()
        for item in title_suggestions
        if str(item).strip()
    ][:3]

    clean_hashtags = [
        str(item).strip().lstrip("#").lower()
        for item in hashtag_suggestions
        if str(item).strip()
    ][:10]

    clean_summary = summary.strip()

    return {
        "applied": True,
        "status": "generated",
        "model": selected_model,
        "title_suggestions": clean_titles,
        "hashtag_suggestions": clean_hashtags,
        "summary": clean_summary,
    }