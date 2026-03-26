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


def _build_cover_crop_filter(
    crop_box: dict,
    target_width: int,
    target_height: int,
) -> str:
    """
    Build an FFmpeg filter chain that:
    1. crops the selected source region
    2. scales it to cover the destination area while preserving aspect ratio
    3. crops the overflow to the exact destination size

    This removes black bars while avoiding stretching.
    """
    return (
        f"crop={crop_box['w']}:{crop_box['h']}:{crop_box['x']}:{crop_box['y']},"
        f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
        f"crop={target_width}:{target_height}"
    )


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

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"FFmpeg timed out after {FFMPEG_TIMEOUT_SECONDS} seconds for layout '{layout}'"
        ) from exc

    if result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else ""
        stdout = result.stdout.strip() if result.stdout else ""
        error_message = stderr or stdout or "FFmpeg processing failed"
        raise RuntimeError(error_message)

    return {
        "output_path": str(output_path),
        "filename": output_filename,
        "layout": layout,
        "output_url": f"/storage/outputs/{output_filename}",
    }