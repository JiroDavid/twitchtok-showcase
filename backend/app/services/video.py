from pathlib import Path
import subprocess


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = BASE_DIR / "storage" / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG_TIMEOUT_SECONDS = 180


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
            "scale=1080:1920"
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
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,boxblur=20:10[bg];"
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
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
            top = stacked_config["top_crop"]
            bottom = stacked_config["bottom_crop"]

            filter_complex = (
                f"[0:v]crop={top['w']}:{top['h']}:{top['x']}:{top['y']},"
                "scale=1080:672:force_original_aspect_ratio=decrease,"
                "pad=1080:672:(ow-iw)/2:(oh-ih)/2[top];"
                f"[0:v]crop={bottom['w']}:{bottom['h']}:{bottom['x']}:{bottom['y']},"
                "scale=1080:1248:force_original_aspect_ratio=decrease,"
                "pad=1080:1248:(ow-iw)/2:(oh-ih)/2[bottom];"
                "[top][bottom]vstack=inputs=2[outv]"
            )
        else:
            filter_complex = (
                "[0:v]crop=in_w*0.4:in_h*0.4:in_w*0.55:in_h*0.05,"
                "scale=1080:672[top];"
                "[0:v]crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0,"
                "scale=1080:1248[bottom];"
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