from pathlib import Path
import subprocess


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = BASE_DIR / "storage" / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG_TIMEOUT_SECONDS = 180

OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920


def _clamp_split_ratio(value: float, minimum: float = 0.2, maximum: float = 0.8) -> float:
    return max(minimum, min(maximum, value))


def _run_ffmpeg(command: list[str], context: str) -> None:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"FFmpeg timed out after {FFMPEG_TIMEOUT_SECONDS} seconds during {context}"
        ) from exc

    if result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else ""
        stdout = result.stdout.strip() if result.stdout else ""
        error_message = stderr or stdout or "FFmpeg processing failed"
        raise RuntimeError(error_message)


def _escape_subtitles_filter_path(path: Path) -> str:
    raw = path.resolve().as_posix()
    escaped = raw.replace("\\", "\\\\")
    escaped = escaped.replace(":", "\\:")
    escaped = escaped.replace("'", r"\'")
    escaped = escaped.replace("[", r"\[")
    escaped = escaped.replace("]", r"\]")
    escaped = escaped.replace(",", r"\,")
    return escaped


def _build_cover_crop_filter(
    crop_box: dict,
    target_width: int,
    target_height: int,
) -> str:
    x, y = crop_box["x"], crop_box["y"]
    # Clamp w/h to actual video bounds at FFmpeg evaluation time so
    # crops defined against 1920x1080 don't overflow smaller source videos.
    safe_w = f"min({crop_box['w']}\\,in_w-{x})"
    safe_h = f"min({crop_box['h']}\\,in_h-{y})"
    return (
        f"crop={safe_w}:{safe_h}:{x}:{y},"
        f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
        f"crop={target_width}:{target_height}"
    )


def extract_representative_frame(
    input_path: str,
    output_filename: str,
    scale_width: int | None = 720,
) -> dict:
    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    output_path = OUTPUTS_DIR / output_filename

    vf = "thumbnail" if scale_width is None else f"thumbnail,scale={scale_width}:-1"

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-vf",
        vf,
        "-frames:v",
        "1",
        str(output_path),
    ]

    _run_ffmpeg(command, "representative frame extraction")

    return {
        "frame_path": str(output_path),
        "frame_filename": output_filename,
        "frame_url": f"/storage/outputs/{output_filename}",
        "source": "input_video",
    }


def process_video_to_vertical(
    input_path: str,
    output_filename: str,
    layout: str,
    stacked_config: dict | None = None,
) -> dict:
    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    output_path = OUTPUTS_DIR / output_filename

    if layout == "cropped":
        vf = (
            "crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0,"
            f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}"
        )

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_file),
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(output_path),
        ]

    elif layout == "fullscreen":
        filter_complex = (
            f"[0:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
            f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},boxblur=20:10[bg];"
            f"[0:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_file),
            "-filter_complex",
            filter_complex,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(output_path),
        ]

    elif layout == "stacked":
        if stacked_config:
            split_ratio_top = _clamp_split_ratio(
                float(stacked_config.get("split_ratio_top", 0.4))
            )
        else:
            split_ratio_top = 0.4

        top_height = int(round(OUTPUT_HEIGHT * split_ratio_top))
        bottom_height = OUTPUT_HEIGHT - top_height

        if stacked_config:
            top = stacked_config["top_crop"]
            bottom = stacked_config["bottom_crop"]

            top_filter = _build_cover_crop_filter(
                crop_box=top,
                target_width=OUTPUT_WIDTH,
                target_height=top_height,
            )
            bottom_filter = _build_cover_crop_filter(
                crop_box=bottom,
                target_width=OUTPUT_WIDTH,
                target_height=bottom_height,
            )

            filter_complex = (
                f"[0:v]{top_filter}[top];"
                f"[0:v]{bottom_filter}[bottom];"
                "[top][bottom]vstack=inputs=2[outv]"
            )
        else:
            default_top_filter = (
                "crop=in_w*0.4:in_h*0.4:in_w*0.55:in_h*0.05,"
                f"scale={OUTPUT_WIDTH}:{top_height}:force_original_aspect_ratio=increase,"
                f"crop={OUTPUT_WIDTH}:{top_height}"
            )
            default_bottom_filter = (
                "[0:v]crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0,"
                f"scale={OUTPUT_WIDTH}:{bottom_height}:force_original_aspect_ratio=increase,"
                f"crop={OUTPUT_WIDTH}:{bottom_height}"
            )

            filter_complex = (
                f"[0:v]{default_top_filter}[top];"
                f"{default_bottom_filter}[bottom];"
                "[top][bottom]vstack=inputs=2[outv]"
            )

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_file),
            "-filter_complex",
            filter_complex,
            "-map",
            "[outv]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(output_path),
        ]

    else:
        raise ValueError(f"Unsupported layout: {layout}")

    _run_ffmpeg(command, f"layout '{layout}' render")

    return {
        "output_path": str(output_path),
        "filename": output_filename,
        "layout": layout,
        "output_url": f"/storage/outputs/{output_filename}",
    }


def burn_subtitles_into_video(
    input_video_path: str,
    subtitles_path: str,
    output_filename: str,
    subtitle_format: str = "auto",
) -> dict:
    input_video = Path(input_video_path)
    subtitles_file = Path(subtitles_path)

    if not input_video.exists():
        raise FileNotFoundError(f"Input video not found: {input_video_path}")

    if not subtitles_file.exists():
        raise FileNotFoundError(f"Subtitle file not found: {subtitles_path}")

    output_path = OUTPUTS_DIR / output_filename

    resolved_format = subtitle_format
    if resolved_format == "auto":
        resolved_format = subtitles_file.suffix.lower().lstrip(".")

    escaped_path = _escape_subtitles_filter_path(subtitles_file)

    if resolved_format == "ass":
        subtitle_filter = f"ass='{escaped_path}'"
    else:
        subtitle_filter = f"subtitles='{escaped_path}'"

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_video),
        "-vf",
        subtitle_filter,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(output_path),
    ]

    _run_ffmpeg(command, f"{resolved_format} subtitle burn-in")

    return {
        "output_path": str(output_path),
        "filename": output_filename,
        "output_url": f"/storage/outputs/{output_filename}",
    }