from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.jobs import (
    ClipDownloadJobRequest,
    CropRerenderJobRequest,
    JobCreateResponse,
    JobStatusResponse,
    LayoutAnalysisJobRequest,
    SubtitleRerenderJobRequest,
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
from app.services.transcription import (
    load_captions_json,
    save_captions_json,
    transcribe_video_to_srt,
    update_captions_payload_with_edits,
    write_ass_from_captions_json,
    write_srt_from_captions_json,
)
from app.services.twitch_api import download_twitch_clip, extract_clip_slug
from app.services.video import (
    burn_subtitles_into_video,
    extract_representative_frame,
    process_video_to_vertical,
)
from app.services.layout_analysis import analyze_video_layout
from app.services.vision_analysis import DEFAULT_VISION_MODEL, generate_vision_notes

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _apply_default_caption_style(
    captions_json_path: str,
    default_style: dict | None,
) -> list[dict]:
    if not default_style:
        payload = load_captions_json(captions_json_path)
        return payload.get("captions", [])

    payload = load_captions_json(captions_json_path)
    updated_items: list[dict] = []

    for item in payload.get("captions", []):
        merged_item = dict(item)
        existing_style = dict(item.get("style") or {})

        for key, value in default_style.items():
            if value is not None:
                existing_style[key] = value

        merged_item["style"] = existing_style
        updated_items.append(merged_item)

    payload["captions"] = updated_items
    save_captions_json(captions_json_path, payload)
    return updated_items


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
                "download_url": result.get("download_url"),
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
    crop_source: str | None = None,
) -> None:
    print(
        f"[jobs] Starting video job: job_id={job_id}, input_path={input_path}, "
        f"layout={layout}, stacked_config={stacked_config}, captions={captions}, "
        f"metadata={metadata}, crop_source={crop_source}"
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
        censor_subtitles = bool(captions.get("censor_subtitles")) if captions else False
        default_caption_style = (
            captions.get("default_style") if captions else None
        )

        metadata_enabled = True if not metadata else bool(metadata.get("enabled", True))
        vision_model = metadata.get("vision_model") if metadata else None
        metadata_model = metadata.get("metadata_model") if metadata else None

        selected_vision_model = vision_model or DEFAULT_VISION_MODEL
        selected_metadata_model = metadata_model or DEFAULT_METADATA_MODEL

        metadata_config_snapshot = {
            "job_id": job_id,
            "layout": layout,
            "stacked_config": stacked_config,
            "captions": {
                "enabled": captions_enabled,
                "burn_in": burn_in,
                "refine_with_llm": refine_with_llm,
                "refinement_model": refinement_model,
                "censor_subtitles": censor_subtitles,
                "default_style": default_caption_style,
            },
            "metadata": {
                "enabled": metadata_enabled,
                "vision_model": selected_vision_model,
                "metadata_model": selected_metadata_model,
            },
        }

        captions_result = None

        if captions_enabled:
            transcription_srt_filename = f"{stem}_{layout}_{short_job_id}.srt"
            transcription_result = transcribe_video_to_srt(
                input_path=input_path,
                output_filename=transcription_srt_filename,
            )

            captions_json_path = transcription_result["captions_json_path"]

            if refine_with_llm:
                try:
                    refinement_result = refine_captions_json(
                        captions_json_path=captions_json_path,
                        model_name=refinement_model,
                    )
                except Exception as exc:
                    print(
                        f"[jobs] Caption refinement failed: job_id={job_id}, error={exc}"
                    )
                    refinement_result = {
                        "applied": False,
                        "model": refinement_model or "llama3:8b",
                        "error": str(exc),
                    }
            else:
                refinement_result = None

            _apply_default_caption_style(
                captions_json_path=captions_json_path,
                default_style=default_caption_style,
            )

            srt_filename = f"{stem}_{layout}_{short_job_id}_styled.srt"
            srt_result = write_srt_from_captions_json(
                captions_json_path=captions_json_path,
                output_filename=srt_filename,
            )

            ass_filename = f"{stem}_{layout}_{short_job_id}_styled.ass"
            ass_result = write_ass_from_captions_json(
                captions_json_path=captions_json_path,
                output_filename=ass_filename,
            )

            current_captions_payload = load_captions_json(captions_json_path)

            captions_result = {
                "enabled": True,
                "burned_in": False,
                "srt_path": srt_result["srt_path"],
                "srt_filename": srt_result["srt_filename"],
                "srt_url": srt_result["srt_url"],
                "ass_path": ass_result["ass_path"],
                "ass_filename": ass_result["ass_filename"],
                "ass_url": ass_result["ass_url"],
                "captions_json_path": captions_json_path,
                "captions_json_filename": Path(captions_json_path).name,
                "captions_json_url": f"/storage/outputs/{Path(captions_json_path).name}",
                "refinement": refinement_result,
                "items": current_captions_payload.get("captions", []),
            }

        result = process_video_to_vertical(
            input_path=input_path,
            output_filename=output_filename,
            layout=layout,
            stacked_config=stacked_config,
        )

        result["base_output_path"] = result["output_path"]
        result["base_output_url"] = result["output_url"]
        result["base_filename"] = result["filename"]

        if captions_enabled and burn_in and captions_result:
            burned_output_filename = f"{stem}_{layout}_{short_job_id}_subtitled.mp4"
            burned_video = burn_subtitles_into_video(
                input_video_path=result["output_path"],
                subtitles_path=captions_result["ass_path"],
                output_filename=burned_output_filename,
                subtitle_format="ass",
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
                config=metadata_config_snapshot,
            )

            try:
                vision_result = generate_vision_notes(
                    image_path=representative_frame["frame_path"],
                    model_name=vision_model,
                )
            except Exception as exc:
                print(f"[jobs] Vision analysis failed: {exc}")
                vision_result = {
                    "applied": False,
                    "status": "failed",
                    "model": selected_vision_model,
                    "reason": str(exc),
                    "notes": None,
                }

            metadata_payload = apply_vision_notes(metadata_payload, vision_result)

            try:
                generation_result = generate_metadata_suggestions(
                    metadata_payload=metadata_payload,
                    model_name=metadata_model,
                )
            except Exception as exc:
                print(f"[jobs] Metadata generation failed: {exc}")
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
                metadata_payload, generation_result
            )

            metadata_result = save_clip_metadata(
                metadata_payload=metadata_payload,
                output_filename=metadata_filename,
            )

            result["metadata"] = {
                **metadata_result,
                "payload": metadata_payload,
            }

        result["stacked_config_used"] = stacked_config
        result["crop_source"] = crop_source

        update_job_status(job_id, "completed", result=result)

        print(f"[jobs] Video job completed: {job_id}")

    except Exception as exc:
        print(f"[jobs] Video job failed: {job_id}, error={exc}")
        update_job_status(job_id, "failed", error=str(exc))


def process_subtitle_rerender_job(
    job_id: str,
    input_video_path: str,
    captions_json_path: str | None,
    items: list[dict],
) -> None:
    print(
        f"[jobs] Starting subtitle rerender job: job_id={job_id}, "
        f"input_video_path={input_video_path}, captions_json_path={captions_json_path}"
    )

    try:
        update_job_status(job_id, "processing")

        input_video = Path(input_video_path)
        short_job_id = job_id.split("-")[0]

        if not input_video.exists():
            raise FileNotFoundError(f"Input video not found: {input_video_path}")

        if captions_json_path:
            captions_json_file = Path(captions_json_path)
            if not captions_json_file.exists():
                raise FileNotFoundError(f"Captions JSON not found: {captions_json_path}")
            captions_payload = load_captions_json(captions_json_path)
            updated_payload = update_captions_payload_with_edits(captions_payload, items)
            saved_json_result = save_captions_json(captions_json_path, updated_payload)
            json_stem = captions_json_file.stem
        else:
            fresh_payload = {"captions": items}
            fresh_json_filename = f"{input_video.stem}_manual_{short_job_id}.json"
            updated_payload = fresh_payload
            saved_json_result = save_captions_json(
                f"/tmp/{fresh_json_filename}", updated_payload
            )
            captions_json_path = saved_json_result["captions_json_path"]
            json_stem = Path(captions_json_path).stem

        srt_filename = f"{json_stem}_edited_{short_job_id}.srt"
        srt_result = write_srt_from_captions_json(
            captions_json_path=captions_json_path,
            output_filename=srt_filename,
        )

        ass_filename = f"{json_stem}_edited_{short_job_id}.ass"
        ass_result = write_ass_from_captions_json(
            captions_json_path=captions_json_path,
            output_filename=ass_filename,
        )

        rerender_filename = f"{input_video.stem}_edited_subtitled_{short_job_id}.mp4"
        rerender_result = burn_subtitles_into_video(
            input_video_path=input_video_path,
            subtitles_path=ass_result["ass_path"],
            output_filename=rerender_filename,
            subtitle_format="ass",
        )

        result = {
            "output_path": rerender_result["output_path"],
            "filename": rerender_result["filename"],
            "output_url": rerender_result["output_url"],
            "captions": {
                "enabled": True,
                "burned_in": True,
                "srt_path": srt_result["srt_path"],
                "srt_filename": srt_result["srt_filename"],
                "srt_url": srt_result["srt_url"],
                "ass_path": ass_result["ass_path"],
                "ass_filename": ass_result["ass_filename"],
                "ass_url": ass_result["ass_url"],
                "captions_json_path": saved_json_result["captions_json_path"],
                "captions_json_filename": saved_json_result["captions_json_filename"],
                "captions_json_url": saved_json_result["captions_json_url"],
                "edited": True,
                "items": updated_payload.get("captions", []),
            },
        }

        update_job_status(job_id, "completed", result=result)
        print(f"[jobs] Subtitle rerender job completed: {job_id}")

    except Exception as exc:
        print(f"[jobs] Subtitle rerender job failed: {job_id}, error={exc}")
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
        payload={"clip_url": clip_url, "clip_slug": clip_slug},
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
    crop_source = payload.crop_source

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
            "crop_source": crop_source,
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
        crop_source,
    )

    return JobCreateResponse(job_id=job_id, status="queued")


@router.post("/subtitle-rerender", response_model=JobCreateResponse)
def create_subtitle_rerender_job(
    payload: SubtitleRerenderJobRequest,
    background_tasks: BackgroundTasks,
):
    input_video_file = Path(payload.input_video_path)

    if not input_video_file.exists():
        raise HTTPException(status_code=404, detail="Input video file not found")

    if payload.captions_json_path:
        captions_json_file = Path(payload.captions_json_path)
        if not captions_json_file.exists():
            raise HTTPException(status_code=404, detail="Captions JSON file not found")

    job_id = create_job(
        job_type="subtitle_rerender",
        payload={
            "input_video_path": payload.input_video_path,
            "captions_json_path": payload.captions_json_path,
            "items": [item.model_dump() for item in payload.items],
        },
    )

    background_tasks.add_task(
        process_subtitle_rerender_job,
        job_id,
        payload.input_video_path,
        payload.captions_json_path,
        [item.model_dump() for item in payload.items],
    )

    return JobCreateResponse(job_id=job_id, status="queued")


def process_crop_rerender_job(
    job_id: str,
    input_path: str,
    stacked_config: dict,
    captions_ass_path: str | None,
) -> None:
    print(
        f"[jobs] Starting crop rerender job: job_id={job_id}, input_path={input_path}, "
        f"stacked_config={stacked_config}"
    )

    try:
        update_job_status(job_id, "processing")

        input_file = Path(input_path)
        if not input_file.exists():
            raise FileNotFoundError(f"Input video not found: {input_path}")

        short_job_id = job_id.split("-")[0]
        output_filename = f"{input_file.stem}_cropadjust_{short_job_id}.mp4"

        result = process_video_to_vertical(
            input_path=input_path,
            output_filename=output_filename,
            layout="stacked",
            stacked_config=stacked_config,
        )

        result["stacked_config_used"] = stacked_config
        result["crop_source"] = "manual"

        if captions_ass_path:
            ass_file = Path(captions_ass_path)
            if ass_file.exists():
                burned_filename = f"{input_file.stem}_cropadjust_{short_job_id}_subtitled.mp4"
                burned = burn_subtitles_into_video(
                    input_video_path=result["output_path"],
                    subtitles_path=captions_ass_path,
                    output_filename=burned_filename,
                    subtitle_format="ass",
                )
                result["output_path"] = burned["output_path"]
                result["filename"] = burned["filename"]
                result["output_url"] = burned["output_url"]

        update_job_status(job_id, "completed", result=result)
        print(f"[jobs] Crop rerender job completed: {job_id}")

    except Exception as exc:
        print(f"[jobs] Crop rerender job failed: {job_id}, error={exc}")
        update_job_status(job_id, "failed", error=str(exc))


@router.post("/crop-rerender", response_model=JobCreateResponse)
def create_crop_rerender_job(
    payload: CropRerenderJobRequest,
    background_tasks: BackgroundTasks,
):
    input_file = Path(payload.input_path)
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Input video file not found")

    stacked_config_dict = payload.stacked_config.model_dump()

    job_id = create_job(
        job_type="crop_rerender",
        payload={
            "input_path": payload.input_path,
            "stacked_config": stacked_config_dict,
            "captions_ass_path": payload.captions_ass_path,
        },
    )

    background_tasks.add_task(
        process_crop_rerender_job,
        job_id,
        payload.input_path,
        stacked_config_dict,
        payload.captions_ass_path,
    )

    return JobCreateResponse(job_id=job_id, status="queued")


def process_layout_analysis_job(
    job_id: str,
    input_path: str,
    vision_model: str | None,
) -> None:
    print(
        f"[jobs] Starting layout analysis job: job_id={job_id}, input_path={input_path}"
    )

    try:
        update_job_status(job_id, "processing")

        input_file = Path(input_path)
        if not input_file.exists():
            raise FileNotFoundError(f"Input video not found: {input_path}")

        short_job_id = job_id.split("-")[0]
        frame_filename = f"{input_file.stem}_layout_analysis_{short_job_id}_frame.jpg"

        representative_frame = extract_representative_frame(
            input_path=input_path,
            output_filename=frame_filename,
        )

        analysis_result = analyze_video_layout(
            image_path=representative_frame["frame_path"],
            model_name=vision_model,
        )

        update_job_status(
            job_id,
            "completed",
            result={
                **analysis_result,
                "frame": representative_frame,
            },
        )

        print(f"[jobs] Layout analysis job completed: {job_id}")

    except Exception as exc:
        print(f"[jobs] Layout analysis job failed: {job_id}, error={exc}")
        update_job_status(job_id, "failed", error=str(exc))


@router.post("/analyze-layout", response_model=JobCreateResponse)
def create_layout_analysis_job(
    payload: LayoutAnalysisJobRequest,
    background_tasks: BackgroundTasks,
):
    input_file = Path(payload.input_path)
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Input video file not found")

    job_id = create_job(
        job_type="layout_analysis",
        payload={
            "input_path": payload.input_path,
            "vision_model": payload.vision_model,
        },
    )

    background_tasks.add_task(
        process_layout_analysis_job,
        job_id,
        payload.input_path,
        payload.vision_model,
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