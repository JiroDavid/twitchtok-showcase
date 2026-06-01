# TwitchTok Showcase

A full, working multi-page website for the CCI Summer Festival stand. Visitors land on a polished
demo page; the real pipeline (Twitch login, file upload) works behind it so Jiro can walk people
through the whole product.

Built from the dissertation repo. The original is preserved at the `dissertation` remote -- never
push there.

---

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Backend:** FastAPI (Python), FFmpeg, Whisper
- **Dev:** WSL2, `~/repos/twitchtok-showcase`; run `npm run dev` from `frontend/`

---

## Site structure

| Page | Purpose |
|------|---------|
| `/` (landing) | The showpiece. Demo flow lives here. |
| `/app` | Real app UI -- Twitch login + clip editor |
| `/upload` | File/URL input modes |
| `/faq` | What it is, how it works, tech, contact |

Navigation makes it feel like one polished product.

---

## Demo flow (landing page)

Single page with auto-scroll between steps:

1. Pick one of 3 preloaded Twitch clips (hover to preview, click to select)
2. Configure -- font, colour, layout
3. Processing window (5-10s): stepped messages ("AI analysing... Whisper transcribing... Rendering...")
4. Reveal -- finished captioned vertical clip plays

### Caching architecture

The slow AI steps (Whisper transcript + crop coords) are pre-computed per clip and cached. At demo
time the styling renders live from that cache via FFmpeg. Fast, deterministic, nothing faked -- the
AI step is just pre-run.

---

## Design direction

- Twitch-purple accent (`#9146FF`) throughout
- Dark base (zinc-950 / zinc-900)
- Clean, modern type -- no clutter
- Mouse and keyboard input (stand PC); normal tap-target sizing
- Responsive but optimised for a large widescreen stand display
- The landscape-to-vertical morph and the finished-video reveal are the high-polish moments

---

## Work tracks

**Track A -- Frontend (priority)**
1. Landing/demo page hero
2. Branding pass (purple accent, type, spacing)
3. Clean up existing app UI for the `/app` route
4. FAQ + upload pages

**Track B -- AI pipeline (run in parallel)**
1. Audit current models in use (Whisper model size, crop detection approach)
2. Swap to `faster-whisper` large-v3 + VAD (16kHz mono audio)
3. Replace LLaVA crop detection with YOLOv8 / MediaPipe face tracking
4. Pre-cache transcript + crop coords for the 3 demo clips

---

## Conventions

- No em dashes (--) in copy or comments; use a regular dash or rewrite the sentence
- No comments unless the WHY is non-obvious
- Commit to `origin` (twitchtok-showcase); never push to `dissertation`
