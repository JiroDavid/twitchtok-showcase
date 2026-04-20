import json
import re
from pathlib import Path

_PROFANE_WORDS = [
    "fuck", "fucking", "fucker", "fucked", "fucks", "fuckin", "fuckers",
    "shit", "shitting", "shitty", "shits", "bullshit", "bullshitting",
    "ass", "asshole", "assholes", "asses",
    "bitch", "bitches", "bitching", "bitchy",
    "cunt", "cunts",
    "bastard", "bastards",
    "piss", "pissed", "pisses", "pissing",
    "cock", "cocks", "cockhead",
    "dick", "dicks",
    "pussy", "pussies",
    "whore", "whores",
    "slut", "sluts",
    "damn", "damnit", "damned",
    "crap",
    "bollocks",
    "wanker", "wankers", "wanking",
    "twat", "twats",
]

# Sort longest first so longer variants (e.g. "fucking") are matched before shorter roots ("fuck")
_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in sorted(_PROFANE_WORDS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


def _censor_match(match: re.Match) -> str:
    word = match.group(0)
    if len(word) <= 1:
        return word
    return word[0] + "*" * (len(word) - 1)


def censor_text(text: str) -> str:
    return _PATTERN.sub(_censor_match, text)


def censor_captions_json(captions_json_path: str) -> None:
    json_file = Path(captions_json_path)
    payload = json.loads(json_file.read_text(encoding="utf-8"))

    for caption in payload.get("captions", []):
        if caption.get("final_text"):
            caption["final_text"] = censor_text(caption["final_text"])
        if caption.get("refined_text"):
            caption["refined_text"] = censor_text(caption["refined_text"])

    json_file.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
