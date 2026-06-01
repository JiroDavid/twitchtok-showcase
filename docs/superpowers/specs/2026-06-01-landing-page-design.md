# Landing Page Design

**Date:** 2026-06-01
**Scope:** `/` landing/demo page for the CCI Summer Festival stand

---

## Goal

A single, long scrollable page that guides a stand visitor through the full TwitchTok demo in four
steps. The page is the showpiece -- it needs to feel polished, fast, and impressive on a widescreen
stand display with mouse and keyboard input.

---

## Routes

| Path | Content | Source |
|------|---------|--------|
| `/` | New landing/demo page | `src/app/page.tsx` (new file) |
| `/app` | Existing full editor | `src/app/app/page.tsx` (moved from `src/app/page.tsx`) |
| `/faq` | FAQ placeholder | `src/app/faq/page.tsx` (stub, later) |

The existing editor is moved verbatim. Only its internal component import paths change (`./components/X` to `../components/X`).

---

## File structure

```
src/app/
  page.tsx                     -- landing orchestrator (new)
  layout.tsx                   -- updated: title, shared Nav
  globals.css                  -- updated: --color-twitch: #9146FF
  app/
    page.tsx                   -- existing editor (moved, untouched)
  faq/
    page.tsx                   -- stub
  components/
    Nav.tsx                    -- shared nav: TwitchTok logo / Demo / App / FAQ
    demo/
      DemoHero.tsx             -- headline + "pick a clip below to try it live"
      ClipPicker.tsx           -- 3 clip cards
      StyleConfigurator.tsx    -- font / colour / layout + Generate button
      ProcessingWindow.tsx     -- stepped AI messages + backend job
      RevealPanel.tsx          -- centred phone frame + download CTA
      MiniPhonePreview.tsx     -- sticky sidebar preview (steps 2-3 only)
```

---

## State

Owned entirely by the landing `page.tsx` orchestrator. No context or external store needed.

```typescript
type DemoStage = "pick" | "configure" | "processing" | "reveal";

type DemoConfig = {
  font: HighlightFontOption;  // "Montserrat" | "Barlow Condensed" | etc.
  color: string;              // hex, e.g. "#FFFFFF"
  layout: LayoutOption;       // "cropped" | "fullscreen" | "stacked"
};

// Root state fields
selectedClipIndex: number | null  // 0 | 1 | 2 — null until a clip is picked
stage: DemoStage                  // drives active step + scroll
config: DemoConfig                // updated live as user changes controls
outputUrl: string | null          // set when processing job completes
```

---

## Page layout

Long single-column scroll. Steps 2-4 use a two-column grid:
`grid-cols-[1fr_120px]` -- steps on the left, `MiniPhonePreview` sticky on the right.

```
[Nav]
[DemoHero]          -- full width, dark gradient hero
[ClipPicker]        -- full width, 3 cards centered
[StyleConfigurator] -- left col  |  [MiniPhonePreview sticky]
[ProcessingWindow]  -- left col  |  [MiniPhonePreview sticky]
[RevealPanel]       -- full width, MiniPhonePreview hidden
```

`MiniPhonePreview` is visible during `configure` and `processing` stages only. At `reveal`,
`RevealPanel` takes over the full width and shows the expanded phone frame centred on screen.

---

## Components

### Nav
- Logo (purple square + "TwitchTok"), links: Demo / App / FAQ
- Active link underlined in `#9146FF`
- Shared via `layout.tsx`, present on all pages

### DemoHero
- Purple eyebrow label: "AI-Powered Short-Form Video"
- H1: "Turn Twitch clips into viral shorts"
- Subline: "in seconds, automatically"
- Scroll cue: "↓ Pick a clip below to try it live"
- Dark radial gradient background (`#1c1020` → `#09090b`)

### ClipPicker
Props: `selectedClipIndex`, `onSelect(index)`

- 3 clip cards defined as a static array: `{ title, streamer, duration, videoSrc, thumbnailSrc }`
- Each card renders an HTML `<video>` element: `autoPlay muted loop playsInline`
- **Hover:** `scale(1.05)`, border switches to `#9146FF`, box-shadow glow, audio unmutes (`video.muted = false`)
- **Hover leave:** audio remutes unless this card is selected
- **Selected state:** purple checkmark badge top-left, persistent glow
- **Click:** sets `selectedClipIndex`, auto-scrolls to StyleConfigurator step

### StyleConfigurator
Props: `config`, `onConfigChange`, `selectedClipIndex`, `onGenerate`

- Step label: `Step 2 -- Customise` (purple, uppercase, left border accent)
- Controls: font dropdown, colour swatches (4-5 options), layout selector
- All changes call `onConfigChange` immediately -- MiniPhonePreview reacts live
- "Generate Highlight" button: disabled until `selectedClipIndex !== null`, triggers `onGenerate`
- `onGenerate` sets `stage = "processing"` and auto-scrolls to ProcessingWindow

### ProcessingWindow
Props: `selectedClipIndex`, `config`, `onComplete(outputUrl)`

- Step label: `Step 3 -- Processing`
- Mounts and immediately fires `POST /jobs/process-video` with the selected clip's cached
  `input_path` and the user's config mapped to `HighlightConfig`
- Simultaneously runs a timed message sequence:
  ```
  0.0s  "Analysing video content..."    pending → spinner
  1.5s  "Whisper transcribing audio..."  pending → spinner
  3.5s  "Applying your style..."         pending → spinner
  5.5s  "Rendering vertical format..."   pending → spinner
  7.5s  "Finishing up..."                pending → spinner
  ```
  Each step flips from pending (empty circle) to active (purple spinner) to done (green check)
- Progress bar fills proportionally beneath the list
- When the backend job completes AND the message sequence has reached the final step,
  calls `onComplete(outputUrl)` -- the later of the two wins (never reveals before messages finish)
- On backend error: shows a friendly error message + "Try again" button that resets to `configure`

### RevealPanel
Props: `outputUrl`, `onReset`

- Step label: `Step 4 -- Your Highlight`
- Full-width section; `MiniPhonePreview` is hidden at this stage
- Centred layout: large phone frame on the left, CTA text on the right
- Phone frame entrance: the reveal section fades in while the phone frame scales up from ~60% to
  100% (~400ms ease-out). This is a CSS scale-up entrance on the reveal section itself -- not a
  FLIP animation tracking the mini preview's page position. The mini preview fades out just before
  the reveal section becomes visible. Purple border glow pulses once on entrance.
- Phone frame shows the `outputUrl` video playing (autoPlay, loop, no controls)
- CTA: "Download" button (links to `outputUrl` with `download` attribute), "Try another clip"
  button (calls `onReset` which resets state to `stage = "pick"` and scrolls to top)

### MiniPhonePreview
Props: `stage`, `config`, `selectedClipIndex`

- Visible only when `stage === "configure" || stage === "processing"`
- Position: `sticky top-8` in the right column of the two-column grid
- Shows a phone frame with the selected clip's thumbnail tinted with the chosen colour, and a
  sample caption bar in the chosen font and colour -- a live style preview, not a rendered video.
  Montserrat and Barlow Condensed load as Google Fonts and match exactly. Gibson, Futura, and
  Komika Axis are not web fonts -- the preview uses the closest available sans-serif approximation
- Label: "Live Preview" + "Updates live" underneath
- Small downward arrow + "expands at Step 4" hint text
- At `reveal`, the component unmounts (or `display: none`) and `RevealPanel` takes the stage

---

## Backend integration

The demo page uses existing backend endpoints unchanged:

- `POST /jobs/process-video` -- same payload shape as existing editor (`HighlightConfig`)
- `GET /jobs/{job_id}` -- polling every 2s, same as existing editor

**Pre-cached clips:** the 3 demo clip source videos must be present in
`backend/storage/downloads/` before the show. Their `input_path` values are hardcoded in
`ClipPicker`'s static clip array. The Whisper transcripts and crop coordinates are pre-run so
the job completes in a few seconds rather than minutes.

**Config mapping:** `StyleConfigurator` builds a `HighlightConfig` object directly. No new
backend types or endpoints needed.

---

## Styling

- CSS variable added to `globals.css`: `--color-twitch: #9146FF`
- Dark base: `bg-zinc-950` / `bg-zinc-900`
- Accent: Twitch purple throughout (borders, glows, active states, CTAs)
- Font: Geist Sans (already configured in `layout.tsx`)
- All transitions: `transition-all duration-150 ease-out` for card hovers;
  `duration-400 ease-out` for the reveal phone entrance
- No em dashes anywhere -- use regular dashes or rewrite

---

## Scroll behaviour

Each stage transition calls `sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })` on the target section. Same pattern already used in the existing editor's `outputPreviewRef`.

---

## Out of scope for this spec

- FAQ page content
- File/URL upload page
- Track B AI pipeline changes (faster-whisper, YOLOv8)
- Mobile/touch optimisation (stand uses mouse + keyboard)
- Twitch OAuth on the landing page (that lives in `/app`)
