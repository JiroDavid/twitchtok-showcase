import json
import shutil
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.schemas.jobs import EditableCaptionItem, StackedConfig
from app.services.jobs import create_job, get_job
from app.services.transcription import write_ass_from_captions_json
from app.routes.jobs import (
    process_subtitle_rerender_job,
    process_crop_rerender_job,
)

router = APIRouter(prefix="/demo-cache", tags=["demo"])

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEMO_CACHE_DIR = _REPO_ROOT / "frontend" / "public" / "demo_cache"
_DOWNLOADS_DIR = _REPO_ROOT / "backend" / "storage" / "downloads"

LayoutLiteral = Literal["stacked", "fullscreen", "cropped"]


def _demo_clip_dir(clip_index: int) -> Path:
    return _DEMO_CACHE_DIR / f"clip{clip_index + 1}"


class PromoteRequest(BaseModel):
    job_id: str
    layout: LayoutLiteral = "stacked"


class SubtitleRerenderDemoRequest(BaseModel):
    clip_index: int
    items: list[EditableCaptionItem]
    layout: LayoutLiteral = "stacked"


class CropRerenderDemoRequest(BaseModel):
    clip_index: int
    stacked_config: StackedConfig


@router.post("/{clip_index}/promote")
def promote_to_demo_cache(clip_index: int, payload: PromoteRequest):
    """Copy a completed job's outputs into frontend/public/demo_cache/clip{n}/."""
    job = get_job(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job status is '{job['status']}', expected 'completed'",
        )

    result = job.get("result") or {}
    dest = _demo_clip_dir(clip_index)
    dest.mkdir(parents=True, exist_ok=True)

    # Save layout-specific base video (no captions)
    if base_path := result.get("base_output_path"):
        shutil.copy2(base_path, dest / f"base_{payload.layout}.mp4")

    # Save current output (captions burned in, if applicable) — generic fallback
    if output_path := result.get("output_path"):
        shutil.copy2(output_path, dest / "output.mp4")

    # Save captions.json once (shared across layouts — same transcription)
    captions = result.get("captions") or {}
    if json_path := captions.get("captions_json_path"):
        shutil.copy2(json_path, dest / "captions.json")

    return {"status": "ok", "clip_index": clip_index, "layout": payload.layout}


@router.post("/subtitle-rerender")
def create_demo_subtitle_rerender(
    payload: SubtitleRerenderDemoRequest,
    background_tasks: BackgroundTasks,
):
    """Re-burn subtitles onto the layout-specific base video."""
    clip_dir = _demo_clip_dir(payload.clip_index)

    # Prefer layout-specific base, fall back to generic base.mp4
    base_path = clip_dir / f"base_{payload.layout}.mp4"
    if not base_path.exists():
        base_path = clip_dir / "base.mp4"
    if not base_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No base video found for clip {payload.clip_index + 1} layout '{payload.layout}'. Run initial pipeline first.",
        )

    captions_json = clip_dir / "captions.json"

    job_id = create_job(
        job_type="subtitle_rerender",
        payload={
            "input_video_path": str(base_path),
            "captions_json_path": str(captions_json) if captions_json.exists() else None,
            "items": [item.model_dump() for item in payload.items],
        },
    )

    background_tasks.add_task(
        process_subtitle_rerender_job,
        job_id,
        str(base_path),
        str(captions_json) if captions_json.exists() else None,
        [item.model_dump() for item in payload.items],
    )

    return {"job_id": job_id, "status": "queued"}


@router.post("/crop-rerender")
def create_demo_crop_rerender(
    payload: CropRerenderDemoRequest,
    background_tasks: BackgroundTasks,
):
    """Re-crop from the cut clip and re-burn existing captions."""
    cut_clip = _DOWNLOADS_DIR / f"clip{payload.clip_index + 1}_cut.mp4"
    if not cut_clip.exists():
        raise HTTPException(
            status_code=404,
            detail=f"clip{payload.clip_index + 1}_cut.mp4 not found in downloads. Copy it first.",
        )

    captions_json = _demo_clip_dir(payload.clip_index) / "captions.json"
    captions_ass_path: str | None = None
    if captions_json.exists():
        try:
            ass_result = write_ass_from_captions_json(str(captions_json))
            captions_ass_path = ass_result["ass_path"]
        except Exception:
            captions_ass_path = None

    job_id = create_job(
        job_type="crop_rerender",
        payload={
            "input_path": str(cut_clip),
            "stacked_config": payload.stacked_config.model_dump(),
            "captions_ass_path": captions_ass_path,
        },
    )

    background_tasks.add_task(
        process_crop_rerender_job,
        job_id,
        str(cut_clip),
        payload.stacked_config.model_dump(),
        captions_ass_path,
    )

    return {"job_id": job_id, "status": "queued"}
