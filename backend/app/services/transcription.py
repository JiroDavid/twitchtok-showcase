from pathlib import Path

from app.services.video import OUTPUTS_DIR


DEFAULT_WHISPER_MODEL = "small"
DEFAULT_MAX_WORDS_PER_CHUNK = 3
DEFAULT_SOFT_MAX_CHARS_PER_CHUNK = 14


def _format_srt_timestamp(seconds: float) -> str:
    total_milliseconds = max(0, int(round(seconds * 1000)))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{milliseconds:03}"


def _segments_to_srt(segments: list[dict]) -> str:
    lines: list[str] = []

    for index, segment in enumerate(segments, start=1):
        text = str(segment.get("text", "")).strip()
        if not text:
            continue

        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", start))
        if end < start:
            end = start

        lines.extend(
            [
                str(index),
                f"{_format_srt_timestamp(start)} --> {_format_srt_timestamp(end)}",
                text,
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def _write_srt_file(srt_path: Path, srt_content: str) -> None:
    srt_path.parent.mkdir(parents=True, exist_ok=True)
    srt_path.write_text(srt_content, encoding="utf-8")


def _flatten_word_timestamps(segments: list[dict]) -> list[dict]:
    words: list[dict] = []

    for segment in segments:
        segment_words = segment.get("words") or []

        for word_info in segment_words:
            raw_word = str(word_info.get("word", "")).strip()
            if not raw_word:
                continue

            start = word_info.get("start")
            end = word_info.get("end")

            if start is None or end is None:
                continue

            start_f = float(start)
            end_f = float(end)

            if end_f < start_f:
                end_f = start_f

            words.append(
                {
                    "word": raw_word,
                    "start": start_f,
                    "end": end_f,
                }
            )

    return words


def _chunk_words(
    words: list[dict],
    max_words_per_chunk: int = DEFAULT_MAX_WORDS_PER_CHUNK,
    soft_max_chars_per_chunk: int = DEFAULT_SOFT_MAX_CHARS_PER_CHUNK,
) -> list[dict]:
    chunks: list[dict] = []
    current_words: list[dict] = []

    def flush_current_chunk() -> None:
        nonlocal current_words

        if not current_words:
            return

        text = " ".join(word["word"] for word in current_words).strip()
        if not text:
            current_words = []
            return

        chunks.append(
            {
                "start": current_words[0]["start"],
                "end": current_words[-1]["end"],
                "text": text,
            }
        )
        current_words = []

    for word in words:
        proposed_words = current_words + [word]
        proposed_text = " ".join(item["word"] for item in proposed_words).strip()

        exceeds_word_limit = len(proposed_words) > max_words_per_chunk
        exceeds_char_limit = len(proposed_text) > soft_max_chars_per_chunk

        if current_words and (exceeds_word_limit or exceeds_char_limit):
            flush_current_chunk()

        current_words.append(word)

    flush_current_chunk()
    return chunks


def _word_chunks_to_srt(chunks: list[dict]) -> str:
    lines: list[str] = []

    for index, chunk in enumerate(chunks, start=1):
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue

        start = float(chunk.get("start", 0.0))
        end = float(chunk.get("end", start))
        if end < start:
            end = start

        lines.extend(
            [
                str(index),
                f"{_format_srt_timestamp(start)} --> {_format_srt_timestamp(end)}",
                text,
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def transcribe_video_to_srt(
    input_path: str,
    output_filename: str,
    model_name: str = DEFAULT_WHISPER_MODEL,
) -> dict:
    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    try:
        import whisper
    except ImportError as exc:
        raise RuntimeError(
            "Whisper is not installed. Install backend dependencies to enable captions."
        ) from exc

    model = whisper.load_model(model_name)
    transcription = model.transcribe(
        str(input_file),
        language="en",
        word_timestamps=True,
    )

    segments = transcription.get("segments") or []
    words = _flatten_word_timestamps(segments)

    if words:
        chunks = _chunk_words(words)
        srt_content = _word_chunks_to_srt(chunks)
    else:
        srt_content = _segments_to_srt(segments)

    srt_path = OUTPUTS_DIR / output_filename
    _write_srt_file(srt_path, srt_content)

    return {
        "srt_path": str(srt_path),
        "srt_filename": srt_path.name,
    }