from pathlib import Path
import subprocess


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = BASE_DIR / "storage" / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def process_video_to_vertical(
    input_path: str,
    output_filename: str,
    layout: str,
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

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "FFmpeg processing failed")

    return {
        "output_path": str(output_path),
        "filename": output_filename,
        "layout": layout,
    }