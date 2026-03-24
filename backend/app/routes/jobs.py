from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.jobs import (
    ClipDownloadJobRequest,
    JobCreateResponse,
    JobStatusResponse,
    VideoProcessJobRequest,
)
from app.services.jobs import create_job, get_job, update_job_status
from app.services.twitch_api import download_twitch_clip, extract_clip_slug
from app.services.video import process_video_to_vertical

router = APIRouter(prefix="/jobs", tags=["jobs"])


def process_clip_download_job(job_id: str, clip_url: str) -> None:
    try:
        update_job_status(job_id, "processing")

        clip_slug = extract_clip_slug(clip_url)
        result = download_twitch_clip(clip_url=clip_url, clip_slug=clip_slug)

        update_job_status(
            job_id,
            "completed",
            result={
                "clip_slug": clip_slug,
                "download_path": result["download_path"],
                "filename": result["filename"],
                "source_type": "twitch_clip",
            },
        )
    except Exception as exc:
        update_job_status(job_id, "failed", error=str(exc))


def process_video_job(job_id: str, input_path: str, layout: str) -> None:
    try:
        update_job_status(job_id, "processing")

        input_file = Path(input_path)
        stem = input_file.stem
        output_filename = f"{stem}_{layout}.mp4"

        result = process_video_to_vertical(
            input_path=input_path,
            output_filename=output_filename,
            layout=layout,
        )

        update_job_status(
            job_id,
            "completed",
            result=result,
        )
    except Exception as exc:
        update_job_status(job_id, "failed", error=str(exc))


@router.post("/download-clip", response_model=JobCreateResponse)
def create_clip_download_job(
    payload: ClipDownloadJobRequest,
    background_tasks: BackgroundTasks,
):
    clip_url = str(payload.clip_url)

    try:
        clip_slug = extract_clip_slug(clip_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    job_id = create_job(
        job_type="clip_download",
        payload={
            "clip_url": clip_url,
            "clip_slug": clip_slug,
        },
    )

    background_tasks.add_task(process_clip_download_job, job_id, clip_url)

    return JobCreateResponse(job_id=job_id, status="queued")


@router.post("/process-video", response_model=JobCreateResponse)
def create_video_process_job(
    payload: VideoProcessJobRequest,
    background_tasks: BackgroundTasks,
):
    input_path = payload.input_path
    layout = payload.layout

    input_file = Path(input_path)
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Input video file not found")

    job_id = create_job(
        job_type="video_process",
        payload={
            "input_path": input_path,
            "layout": layout,
        },
    )

    background_tasks.add_task(process_video_job, job_id, input_path, layout)

    return JobCreateResponse(job_id=job_id, status="queued")


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(**job)