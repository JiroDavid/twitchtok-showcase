import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = BASE_DIR / "storage" / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def build_clip_metadata_payload(
    *,
    input_path: str,
    layout: str,
    output_result: dict,
    representative_frame: dict | None = None,
    captions_result: dict | None = None,
) -> dict:
    """
    Build a future-ready metadata scaffold for a processed clip.

    This does not perform AI generation yet.
    It creates a stable structured payload that future vision and LLM steps
    can enrich without changing the rest of the pipeline contract.
    """
    input_file = Path(input_path)

    payload = {
        "version": 1,
        "source": {
            "input_path": input_path,
            "input_filename": input_file.name,
            "source_type": "local_video",
        },
        "render": {
            "layout": layout,
            "output_path": output_result.get("output_path"),
            "output_filename": output_result.get("filename"),
            "output_url": output_result.get("output_url"),
        },
        "representative_frame": representative_frame,
        "captions": {
            "enabled": bool(captions_result),
            "burned_in": bool(captions_result and captions_result.get("burned_in")),
            "srt_path": captions_result.get("srt_path") if captions_result else None,
            "srt_filename": captions_result.get("srt_filename") if captions_result else None,
            "srt_url": captions_result.get("srt_url") if captions_result else None,
            "captions_json_path": (
                captions_result.get("captions_json_path") if captions_result else None
            ),
            "captions_json_filename": (
                captions_result.get("captions_json_filename") if captions_result else None
            ),
            "captions_json_url": (
                captions_result.get("captions_json_url") if captions_result else None
            ),
            "refinement": captions_result.get("refinement") if captions_result else None,
        },
        "vision": {
            "status": "pending",
            "notes": None,
            "model": None,
        },
        "metadata_generation": {
            "status": "pending",
            "title_suggestions": [],
            "hashtag_suggestions": [],
            "summary": None,
            "tone_tags": [],
            "category_tags": [],
            "model": None,
        },
    }

    return payload


def save_clip_metadata(
    *,
    metadata_payload: dict,
    output_filename: str,
) -> dict:
    output_path = OUTPUTS_DIR / output_filename

    output_path.write_text(
        json.dumps(metadata_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "metadata_path": str(output_path),
        "metadata_filename": output_filename,
        "metadata_url": f"/storage/outputs/{output_filename}",
    }