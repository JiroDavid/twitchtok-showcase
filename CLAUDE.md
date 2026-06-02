# TwitchTok Showcase — Claude Instructions

## What this project is

A full-stack demo website built for the CCI Summer Festival stand. Visitors use a polished
interactive demo on the landing page; the real AI pipeline (Twitch login, file upload, live
Whisper + FFmpeg processing) runs behind it so the developer can walk people through the full product.

Original dissertation repo is preserved at the `dissertation` git remote — never push there.

---

## Architecture overview

```
frontend/   Next.js 16 on :3000
backend/    FastAPI on :8000
```

Next.js proxies all `/api/*`, `/jobs/*`, `/clips/*`, `/demo-cache/*`, `/storage/*` requests to
the backend via rewrites in `next.config.ts`. Static assets (clips, demo cache) are served
directly from `frontend/public/`.

---

## Demo mode vs full pipeline

### Demo mode (landing page `/`)

Pre-cached AI results, live styling via FFmpeg at click time.

**Assets on disk (committed via Git LFS):**
- `frontend/public/clips/clip{1,2,3}_cut.mp4` — source clips for live preview
- `frontend/public/demo_cache/clip{N}/base_{cropped,fullscreen,stacked}.mp4` — pre-rendered layout bases (no captions), used as FFmpeg input for subtitle burn-in
- `frontend/public/demo_cache/clip{N}/output.mp4` — most recent captioned output, shown in Step 4
- `frontend/public/demo_cache/clip{N}/captions.json` — caption timing + per-caption style/placement
- `backend/storage/downloads/clip{N}_cut.mp4` — needed by the backend for crop re-renders

**Demo flow (4 steps, auto-scroll):**
1. Pick one of 3 preloaded clips (ClipPicker — hover to preview with audio, click to select)
2. Configure font, colour, layout (StyleConfigurator — recommended badge per clip)
3. Processing window (ProcessingWindow — fake stepped messages, real FFmpeg job runs in parallel, holds at "Finishing up..." until render resolves)
4. Reveal — captioned vertical clip plays in phone frame, AI-generated TikTok metadata shown below

**Clip roster:**
| Index | Clip | Recommended layout |
|-------|------|--------------------|
| 0 | Ludwig crashing out (League tournament) | Stacked |
| 1 | JasonTheWeen + Maya (frog sanctuary) | Cropped |
| 2 | Stable Ronaldo interviews Cyr (Zorg) + Peach (Leeloo) at Streamer Awards | Fullscreen |

### Full pipeline (`/app` route)

Twitch OAuth, paste-URL, or uploaded file. Runs Whisper, FFmpeg, optional Ollama LLM. Separate
from the demo; handled by `frontend/src/app/app/page.tsx`.

---

## Caption color system

`applyConfigToCaptions` in `frontend/src/app/utils.ts` controls how the style config is applied:
- **Bottom track** — gets the config color picker value
- **Top track** — keeps its own `style.color` from `captions.json` (not overridden)

This lets each clip have per-speaker colors baked into captions.json:

| Clip | Bottom track | Top track |
|------|-------------|-----------|
| Ludwig (clip1) | config color | Pink `#FF69B4` except "It's not over / we can do this" and "No we can still do this" which are Orange `#FF8C00` |
| Jason+Maya (clip2) | config color (Jason) | Pink `#FF69B4` (Maya) |
| Ron/Cyr/Peach (clip3) | config color (Ron) | Pink `#FF69B4` for Leeloo lines only ("Leeloo Dallas Multipass", "Multipass!"); Orange `#FF8C00` for Zorg/third-speaker lines |

---

## Key backend routes

| Route | Purpose |
|-------|---------|
| `POST /demo-cache/subtitle-rerender` | Re-burn captions onto a base video |
| `POST /demo-cache/{clip_index}/promote` | Copy job output to demo_cache folder |
| `POST /demo-cache/crop-rerender` | Re-crop from cut clip with new stacked config |
| `GET /jobs/{job_id}` | Poll job status |

The demo subtitle rerender writes updated captions to `OUTPUTS_DIR` (not back to the source
`captions.json`) to avoid corrupting the demo cache between renders.

---

## captions.json format

The file can be either a plain JSON array (`[{id, start, end, final_text, style, placement}, ...]`)
or a dict (`{"captions": [...], "edited": true}`). `load_captions_json` in `transcription.py`
and all three frontend fetch sites normalise both formats.

---

## Code conventions

- No em dashes in copy or comments — use a regular dash or rewrite
- No comments unless the WHY is non-obvious (hidden constraint, workaround, surprising invariant)
- Commit to `origin` (twitchtok-showcase); never push to `dissertation`
- Large video files tracked via Git LFS (`*.mp4` in `.gitattributes`)
- Backend storage (`storage/downloads/*`, `storage/outputs/*`) is gitignored except the 3 demo cut clips

---

## Running locally

```bash
# Backend (from repo root)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (from repo root)
cd frontend && npm run dev
```

Open http://localhost:3000 — the demo landing page is the default route.
