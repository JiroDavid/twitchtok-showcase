import json
import re
from pathlib import Path

from app.services.video import OUTPUTS_DIR


DEFAULT_WHISPER_MODEL = "small"
DEFAULT_MAX_WORDS_PER_CHUNK = 3
DEFAULT_SOFT_MAX_CHARS_PER_CHUNK = 14
DEFAULT_TIME_PRECISION = 2


def _round_time(value: float, precision: int = DEFAULT_TIME_PRECISION) -> float:
    return round(float(value), precision)


def _format_srt_timestamp(seconds: float) -> str:
    total_milliseconds = max(0, int(round(seconds * 1000)))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{milliseconds:03}"


def _clean_caption_text(text: str) -> str:
    text = text.strip()
    text = text.replace("!", "")
    text = text.replace(",", "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _ends_with_hard_stop(text: str) -> bool:
    text = text.strip()
    return text.endswith(".") or text.endswith("?")


def _segments_to_srt(segments: list[dict]) -> str:
    lines: list[str] = []

    for index, segment in enumerate(segments, start=1):
        text = _clean_caption_text(str(segment.get("text", "")))
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


def _write_json_file(json_path: Path, payload: dict) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _read_json_file(json_path: Path) -> dict:
    if not json_path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    return json.loads(json_path.read_text(encoding="utf-8"))


def _flatten_word_timestamps(segments: list[dict]) -> list[dict]:
    words: list[dict] = []

    for segment in segments:
        segment_words = segment.get("words") or []

        for word_info in segment_words:
            raw_word = str(word_info.get("word", "")).strip()
            if not raw_word:
                continue

            cleaned_word = _clean_caption_text(raw_word)
            if not cleaned_word:
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
                    "word": cleaned_word,
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
        text = _clean_caption_text(text)

        if not text:
            current_words = []
            return

        rounded_words = [
            {
                "text": word["word"],
                "start": _round_time(word["start"]),
                "end": _round_time(word["end"]),
            }
            for word in current_words
        ]

        chunks.append(
            {
                "start": _round_time(current_words[0]["start"]),
                "end": _round_time(current_words[-1]["end"]),
                "text": text,
                "words": rounded_words,
            }
        )
        current_words = []

    for word in words:
        if current_words:
            proposed_words = current_words + [word]
            proposed_text = " ".join(item["word"] for item in proposed_words).strip()

            exceeds_word_limit = len(proposed_words) > max_words_per_chunk
            exceeds_char_limit = len(proposed_text) > soft_max_chars_per_chunk

            if exceeds_word_limit or exceeds_char_limit:
                flush_current_chunk()

        current_words.append(word)

        if _ends_with_hard_stop(word["word"]):
            flush_current_chunk()

    flush_current_chunk()
    return chunks


def _word_chunks_to_srt(chunks: list[dict]) -> str:
    lines: list[str] = []

    for index, chunk in enumerate(chunks, start=1):
        text = _clean_caption_text(str(chunk.get("text", "")))
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


def _segments_to_caption_items(segments: list[dict]) -> list[dict]:
    items: list[dict] = []

    for index, segment in enumerate(segments, start=1):
        text = _clean_caption_text(str(segment.get("text", "")))
        if not text:
            continue

        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", start))
        if end < start:
            end = start

        segment_words = []
        for word_info in segment.get("words") or []:
            raw_word = str(word_info.get("word", "")).strip()
            cleaned_word = _clean_caption_text(raw_word)
            if not cleaned_word:
                continue

            word_start = word_info.get("start")
            word_end = word_info.get("end")
            if word_start is None or word_end is None:
                continue

            word_start_f = float(word_start)
            word_end_f = float(word_end)
            if word_end_f < word_start_f:
                word_end_f = word_start_f

            segment_words.append(
                {
                    "text": cleaned_word,
                    "start": _round_time(word_start_f),
                    "end": _round_time(word_end_f),
                }
            )

        items.append(
            {
                "id": index,
                "start": _round_time(start),
                "end": _round_time(end),
                "raw_text": text,
                "refined_text": None,
                "final_text": text,
                "source": "whisper",
                "refinement_source": None,
                "status": "draft",
                "words": segment_words,
            }
        )

    return items


def _word_chunks_to_caption_items(chunks: list[dict]) -> list[dict]:
    items: list[dict] = []

    for index, chunk in enumerate(chunks, start=1):
        text = _clean_caption_text(str(chunk.get("text", "")))
        if not text:
            continue

        start = float(chunk.get("start", 0.0))
        end = float(chunk.get("end", start))
        if end < start:
            end = start

        items.append(
            {
                "id": index,
                "start": _round_time(start),
                "end": _round_time(end),
                "raw_text": text,
                "refined_text": None,
                "final_text": text,
                "source": "whisper",
                "refinement_source": None,
                "status": "draft",
                "words": chunk.get("words", []),
            }
        )

    return items


def _caption_items_to_srt(caption_items: list[dict]) -> str:
    lines: list[str] = []
    written_index = 1

    for item in caption_items:
        text = _clean_caption_text(
            str(
                item.get("final_text")
                or item.get("refined_text")
                or item.get("raw_text")
                or ""
            )
        )
        if not text:
            continue

        start = float(item.get("start", 0.0))
        end = float(item.get("end", start))
        if end < start:
            end = start

        lines.extend(
            [
                str(written_index),
                f"{_format_srt_timestamp(start)} --> {_format_srt_timestamp(end)}",
                text,
                "",
            ]
        )
        written_index += 1

    return "\n".join(lines).strip() + "\n"


def save_captions_json(captions_json_path: str, captions_payload: dict) -> dict:
    json_path = Path(captions_json_path)
    _write_json_file(json_path, captions_payload)

    return {
        "captions_json_path": str(json_path),
        "captions_json_filename": json_path.name,
        "captions_json_url": f"/storage/outputs/{json_path.name}",
    }


def load_captions_json(captions_json_path: str) -> dict:
    return _read_json_file(Path(captions_json_path))


def update_captions_payload_with_edits(
    captions_payload: dict,
    edited_items: list[dict],
) -> dict:
    existing_items = captions_payload.get("captions") or []
    existing_by_id = {
        int(item.get("id")): item
        for item in existing_items
        if item.get("id") is not None
    }

    updated_items: list[dict] = []

    for index, edited_item in enumerate(edited_items, start=1):
        item_id = int(edited_item.get("id", index))
        existing_item = existing_by_id.get(item_id, {})

        start = float(edited_item.get("start", existing_item.get("start", 0.0)))
        end = float(edited_item.get("end", existing_item.get("end", start)))
        if end < start:
            end = start

        updated_items.append(
            {
                "id": item_id,
                "start": _round_time(start),
                "end": _round_time(end),
                "raw_text": str(
                    edited_item.get("raw_text", existing_item.get("raw_text", ""))
                ),
                "refined_text": edited_item.get(
                    "refined_text",
                    existing_item.get("refined_text"),
                ),
                "final_text": _clean_caption_text(
                    str(
                        edited_item.get(
                            "final_text",
                            existing_item.get("final_text")
                            or existing_item.get("refined_text")
                            or existing_item.get("raw_text")
                            or "",
                        )
                    )
                ),
                "source": existing_item.get("source", "whisper"),
                "refinement_source": existing_item.get("refinement_source"),
                "status": "edited",
                "words": existing_item.get("words", []),
            }
        )

    next_payload = dict(captions_payload)
    next_payload["captions"] = updated_items
    next_payload["edited"] = True
    return next_payload


def write_srt_from_captions_json(
    captions_json_path: str,
    output_filename: str | None = None,
) -> dict:
    json_path = Path(captions_json_path)
    payload = load_captions_json(str(json_path))
    caption_items = payload.get("captions") or []

    if output_filename is None:
        output_filename = f"{json_path.stem}.srt"

    srt_path = OUTPUTS_DIR / output_filename
    srt_content = _caption_items_to_srt(caption_items)
    _write_srt_file(srt_path, srt_content)

    return {
        "srt_path": str(srt_path),
        "srt_filename": srt_path.name,
        "srt_url": f"/storage/outputs/{srt_path.name}",
    }


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
        caption_items = _word_chunks_to_caption_items(chunks)
    else:
        srt_content = _segments_to_srt(segments)
        caption_items = _segments_to_caption_items(segments)

    srt_path = OUTPUTS_DIR / output_filename
    _write_srt_file(srt_path, srt_content)

    captions_json_filename = f"{Path(output_filename).stem}.json"
    captions_json_path = OUTPUTS_DIR / captions_json_filename

    captions_payload = {
        "source": "whisper",
        "model": model_name,
        "input_filename": input_file.name,
        "captions": caption_items,
    }

    _write_json_file(captions_json_path, captions_payload)

    return {
        "srt_path": str(srt_path),
        "srt_filename": srt_path.name,
        "captions_json_path": str(captions_json_path),
        "captions_json_filename": captions_json_path.name,
    }