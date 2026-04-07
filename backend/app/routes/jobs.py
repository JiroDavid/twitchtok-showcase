from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.jobs import (
    ClipDownloadJobRequest,
    JobCreateResponse,
    JobStatusResponse,
    VideoProcessJobRequest,
)
from app.services.caption_refinement import refine_captions_json
from app.services.jobs import create_job, get_job, update_job_status, list_jobs
from app.services.metadata import (
    apply_generated_metadata,
    apply_vision_notes,
    build_clip_metadata_payload,
    save_clip_metadata,
)
from app.services.metadata_generation import (
    DEFAULT_METADATA_MODEL,
    generate_metadata_suggestions,
)
from app.services.twitch_api import download_twitch_clip, extract_clip_slug
from app.services.transcription import transcribe_video_to_srt
from app.services.video import (
    burn_subtitles_into_video,
    extract_representative_frame,
    process_video_to_vertical,
)
from app.services.vision_analysis import DEFAULT_VISION_MODEL, generate_vision_notes

router = APIRouter(prefix="/jobs", tags=["jobs"])


def process_clip_download_job(job_id: str, clip_url: str) -> None:
    print(f"[jobs] Starting clip download job: job_id={job_id}, clip_url={clip_url}")

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

        print(f"[jobs] Clip download job completed: job_id={job_id}")

    except Exception as exc:
        print(f"[jobs] Clip download job failed: job_id={job_id}, error={exc}")
        update_job_status(job_id, "failed", error=str(exc))


def process_video_job(
    job_id: str,
    input_path: str,
    layout: str,
    stacked_config=None,
    captions=None,
    metadata=None,
) -> None:
    print(
        f"[jobs] Starting video job: job_id={job_id}, input_path={input_path}, "
        f"layout={layout}, stacked_config={stacked_config}, captions={captions}, "
        f"metadata={metadata}"
    )

    try:
        update_job_status(job_id, "processing")

        input_file = Path(input_path)
        stem = input_file.stem
        short_job_id = job_id.split("-")[0]
        output_filename = f"{stem}_{layout}_{short_job_id}.mp4"
        frame_filename = f"{stem}_{layout}_{short_job_id}_frame.jpg"
        metadata_filename = f"{stem}_{layout}_{short_job_id}_metadata.json"

        captions_enabled = bool(captions and captions.get("enabled"))
        burn_in = True if not captions else bool(captions.get("burn_in", True))
        refine_with_llm = bool(captions and captions.get("refine_with_llm"))
        refinement_model = captions.get("refinement_model") if captions else None

        metadata_enabled = True if not metadata else bool(metadata.get("enabled", True))
        vision_model = metadata.get("vision_model") if metadata else None
        metadata_model = metadata.get("metadata_model") if metadata else None

        selected_vision_model = vision_model or DEFAULT_VISION_MODEL
        selected_metadata_model = metadata_model or DEFAULT_METADATA_MODEL

        captions_result = None

        if captions_enabled:
            srt_filename = f"{stem}_{layout}_{short_job_id}.srt"
            transcription_result = transcribe_video_to_srt(
                input_path=input_path,
                output_filename=srt_filename,
            )

            captions_result = {
                "enabled": True,
                "burned_in": False,
                "srt_path": transcription_result["srt_path"],
                "srt_filename": transcription_result["srt_filename"],
                "srt_url": f"/storage/outputs/{transcription_result['srt_filename']}",
                "captions_json_path": transcription_result["captions_json_path"],
                "captions_json_filename": transcription_result["captions_json_filename"],
                "captions_json_url": f"/storage/outputs/{transcription_result['captions_json_filename']}",
            }

            if refine_with_llm:
                try:
                    refinement_result = refine_captions_json(
                        captions_json_path=transcription_result["captions_json_path"],
                        model_name=refinement_model,
                    )
                    captions_result["refinement"] = refinement_result
                except Exception as exc:
                    print(
                        f"[jobs] Caption refinement failed: job_id={job_id}, error={exc}"
                    )
                    captions_result["refinement"] = {
                        "applied": False,
                        "model": refinement_model or "llama3:8b",
                        "error": str(exc),
                    }

        result = process_video_to_vertical(
            input_path=input_path,
            output_filename=output_filename,
            layout=layout,
            stacked_config=stacked_config,
        )

        if captions_enabled and burn_in and captions_result:
            burned_output_filename = f"{stem}_{layout}_{short_job_id}_subtitled.mp4"
            burned_video = burn_subtitles_into_video(
                input_video_path=result["output_path"],
                subtitles_path=captions_result["srt_path"],
                output_filename=burned_output_filename,
            )
            result["output_path"] = burned_video["output_path"]
            result["filename"] = burned_video["filename"]
            result["output_url"] = burned_video["output_url"]
            captions_result["burned_in"] = True

        representative_frame = extract_representative_frame(
            input_path=input_path,
            output_filename=frame_filename,
        )
        result["representative_frame"] = representative_frame

        if captions_result:
            result["captions"] = captions_result

        if metadata_enabled:
            metadata_payload = build_clip_metadata_payload(
                input_path=input_path,
                layout=layout,
                output_result=result,
                representative_frame=representative_frame,
                captions_result=captions_result,
            )

            try:
                vision_result = generate_vision_notes(
                    image_path=representative_frame["frame_path"],
                    model_name=vision_model,
                )
            except Exception as exc:
                print(
                    f"[jobs] Vision analysis failed: job_id={job_id}, error={exc}"
                )
                vision_result = {
                    "applied": False,
                    "status": "failed",
                    "model": selected_vision_model,
                    "reason": str(exc),
                    "notes": None,
                }

            metadata_payload = apply_vision_notes(
                metadata_payload=metadata_payload,
                vision_result=vision_result,
            )

            try:
                generation_result = generate_metadata_suggestions(
                    metadata_payload=metadata_payload,
                    model_name=metadata_model,
                )
            except Exception as exc:
                print(
                    f"[jobs] Metadata generation failed: job_id={job_id}, error={exc}"
                )
                generation_result = {
                    "applied": False,
                    "status": "failed",
                    "model": selected_metadata_model,
                    "reason": str(exc),
                    "title_suggestions": [],
                    "hashtag_suggestions": [],
                    "summary": None,
                }

            metadata_payload = apply_generated_metadata(
                metadata_payload=metadata_payload,
                generation_result=generation_result,
            )

            metadata_result = save_clip_metadata(
                metadata_payload=metadata_payload,
                output_filename=metadata_filename,
            )
            result["metadata"] = metadata_result

        update_job_status(
            job_id,
            "completed",
            result=result,
        )

        print(
            f"[jobs] Video job completed: job_id={job_id}, "
            f"output_path={result['output_path']}"
        )

    except Exception as exc:
        print(f"[jobs] Video job failed: job_id={job_id}, error={exc}")
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
    stacked_config = payload.stacked_config
    captions = payload.captions
    metadata = payload.metadata

    input_file = Path(input_path)
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Input video file not found")

    job_id = create_job(
        job_type="video_process",
        payload={
            "input_path": input_path,
            "layout": layout,
            "stacked_config": stacked_config.model_dump() if stacked_config else None,
            "captions": captions.model_dump() if captions else None,
            "metadata": metadata.model_dump() if metadata else None,
        },
    )

    background_tasks.add_task(
        process_video_job,
        job_id,
        input_path,
        layout,
        stacked_config.model_dump() if stacked_config else None,
        captions.model_dump() if captions else None,
        metadata.model_dump() if metadata else None,
    )

    return JobCreateResponse(job_id=job_id, status="queued")


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(**job)


@router.get("", response_model=list[JobStatusResponse])
def get_all_jobs():
    jobs = list_jobs()
    return [JobStatusResponse(**job) for job in jobs]