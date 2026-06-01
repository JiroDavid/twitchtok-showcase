# Demo Tools Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire three real Twitch clips into the demo landing page, serve pre-cached outputs in the demo flow, add crop + subtitle editor buttons in the reveal step, upgrade the subtitle editor with a live CSS preview overlay, and upgrade the timeline with zoom, audio waveform, and resizable height.

**Architecture:** The demo landing page resolves to pre-rendered `output.mp4` files per clip after its animation, eliminating live FFmpeg risk. The existing `CropEditorModal` and `SubtitleEditorModal` are mounted from `page.tsx` using demo-specific state; a new `useDemoCropEditor` hook manages crop drag logic. Subtitle live preview is a CSS overlay on the video element, synced to `currentTime`. Timeline zoom is pixel-based with a horizontally scrollable inner div; audio waveform is extracted client-side via Web Audio API.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Web Audio API

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `frontend/src/app/components/demo/demoClips.ts` | Real clip paths + metadata |
| Create | `frontend/public/demo_cache/clip{1,2,3}/captions.json` | Placeholder caption data |
| Create | `frontend/public/demo_cache/clip{1,2,3}/crop.json` | Default crop config |
| Create | `frontend/public/demo_cache/clip{1,2,3}/output.mp4` | (empty placeholder — user replaces) |
| Modify | `frontend/src/app/components/demo/ProcessingWindow.tsx` | Resolve pre-cached output |
| Modify | `frontend/src/app/components/demo/RevealPanel.tsx` | Fine-tune buttons section |
| Create | `frontend/src/app/components/demo/useDemoCropEditor.ts` | Crop drag state hook |
| Modify | `frontend/src/app/page.tsx` | Wire tool modals |
| Modify | `frontend/src/app/components/SubtitleEditorModal.tsx` | Live CSS overlay + audio extraction + resize handle |
| Modify | `frontend/src/app/components/SubtitleTimeline.tsx` | Zoom + waveform + pixel layout |

---

## Task 1: Seed demo cache and update demoClips.ts

**Files:**
- Modify: `frontend/src/app/components/demo/demoClips.ts`
- Create: `frontend/public/demo_cache/clip1/captions.json`
- Create: `frontend/public/demo_cache/clip1/crop.json`
- Create: `frontend/public/demo_cache/clip2/captions.json`
- Create: `frontend/public/demo_cache/clip2/crop.json`
- Create: `frontend/public/demo_cache/clip3/captions.json`
- Create: `frontend/public/demo_cache/clip3/crop.json`

- [ ] **Step 1: Create demo_cache directory structure**

```bash
mkdir -p /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip1
mkdir -p /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip2
mkdir -p /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip3
```

- [ ] **Step 2: Write placeholder captions.json for each clip**

Write identical placeholder content to all three — user will replace with real captions later.

`frontend/public/demo_cache/clip1/captions.json`:
```json
[
  {
    "id": 1,
    "start": 0.0,
    "end": 3.0,
    "final_text": "Caption placeholder",
    "style": {
      "color": "#FFFFFF",
      "font_family": "Montserrat",
      "font_size": 140,
      "outline": 8,
      "shadow": 3
    },
    "placement": {
      "track": "bottom",
      "x": null,
      "y": null,
      "align": "bottom"
    },
    "raw_text": "",
    "refined_text": "",
    "status": "draft",
    "is_manual": true
  }
]
```

Copy the same content to `clip2/captions.json` and `clip3/captions.json`.

- [ ] **Step 3: Write placeholder crop.json for each clip**

`frontend/public/demo_cache/clip1/crop.json` (and clip2, clip3):
```json
{
  "top_crop": { "x": 0, "y": 0, "w": 1920, "h": 540 },
  "bottom_crop": { "x": 0, "y": 540, "w": 1920, "h": 540 },
  "split_ratio_top": 0.5
}
```

- [ ] **Step 4: Update demoClips.ts**

Replace the entire file content:

```typescript
import type { DemoClip } from "../../types";

export const DEMO_CLIPS: DemoClip[] = [
  {
    title: "Insane clutch moment",
    streamer: "ludwig",
    duration: "0:42",
    videoSrc: "/clips/clip1.mp4",
    inputPath: "backend/storage/downloads/clip1.mp4",
  },
  {
    title: "Unexpected reaction",
    streamer: "jasontheween",
    duration: "0:38",
    videoSrc: "/clips/clip2.mp4",
    inputPath: "backend/storage/downloads/clip2.mp4",
  },
  {
    title: "Highlight reel",
    streamer: "stableronaldo",
    duration: "1:02",
    videoSrc: "/clips/clip3.mp4",
    inputPath: "backend/storage/downloads/clip3.mp4",
  },
];
```

- [ ] **Step 5: Start dev server and verify clips play in the picker**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend && npm run dev
```

Open `http://localhost:3000`. The three clip cards should show video thumbnails playing. If they show placeholder gradients, check the network tab for 404s on `/clips/clip*.mp4`.

- [ ] **Step 6: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/demo/demoClips.ts \
  frontend/public/demo_cache/
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: wire real clips into demo picker and seed demo cache"
```

---

## Task 2: Update ProcessingWindow for pre-cached output

**Files:**
- Modify: `frontend/src/app/components/demo/ProcessingWindow.tsx`

- [ ] **Step 1: Replace the backend job useEffect with a pre-cached resolver**

The entire backend `useEffect` (lines 74–147) is replaced. The timed message sequence stays unchanged. Only the resolution changes: after the animation completes, call `onComplete` with the pre-cached URL.

Replace the backend job `useEffect` block with:

```typescript
// Resolve to pre-cached output — no live render in demo mode
useEffect(() => {
  const cachedUrl = `/demo_cache/clip${selectedClipIndex + 1}/output.mp4`;
  jobOutputUrlRef.current = cachedUrl;
  // If the message animation already finished, complete immediately
  if (messagesFinishedRef.current) {
    onCompleteRef.current(cachedUrl);
  }
}, [selectedClipIndex]);
```

Also remove all unused imports — `DEMO_CLIPS` is no longer needed either since `inputPath` was only used in the removed backend job:

```typescript
import { useEffect, useRef, useState } from "react";
import type { DemoConfig } from "../../types";
```

- [ ] **Step 2: Create a placeholder output.mp4 so the reveal doesn't 404**

The reveal panel will try to load `/demo_cache/clip{n}/output.mp4`. Until user provides real outputs, copy one of the raw clips as a placeholder so the page doesn't break:

```bash
cp /home/jirod/repos/twitchtok-showcase/frontend/public/clips/clip1.mp4 \
   /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip1/output.mp4
cp /home/jirod/repos/twitchtok-showcase/frontend/public/clips/clip2.mp4 \
   /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip2/output.mp4
cp /home/jirod/repos/twitchtok-showcase/frontend/public/clips/clip3.mp4 \
   /home/jirod/repos/twitchtok-showcase/frontend/public/demo_cache/clip3/output.mp4
```

- [ ] **Step 3: Verify the full demo flow end-to-end**

With the dev server running:
1. Pick a clip → configure → Generate Highlight
2. The processing animation should play through all 5 steps (~9s)
3. The reveal panel should appear and play `demo_cache/clip{n}/output.mp4`

Expected: no console errors, video plays in the phone frame.

- [ ] **Step 4: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/demo/ProcessingWindow.tsx
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: resolve demo output from pre-cached file instead of live backend"
```

---

## Task 3: Add fine-tune section to RevealPanel

**Files:**
- Modify: `frontend/src/app/components/demo/RevealPanel.tsx`

- [ ] **Step 1: Add the two new props to RevealPanel**

Update the type and function signature:

```typescript
type RevealPanelProps = {
  outputUrl: string;
  onReset: () => void;
  onOpenSubtitleEditor: () => void;
  onOpenCropEditor: () => void;
};

export function RevealPanel({ outputUrl, onReset, onOpenSubtitleEditor, onOpenCropEditor }: RevealPanelProps) {
```

- [ ] **Step 2: Add the fine-tune section below the existing CTA buttons**

Inside the CTA `<div className="max-w-xs">`, after the existing button group div (`<div className="mt-6 flex flex-col gap-3">`), add:

```typescript
<div className="mt-4 border-t border-zinc-800 pt-4">
  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
    Want to fine-tune?
  </p>
  <div className="flex gap-2">
    <button
      onClick={onOpenSubtitleEditor}
      className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-medium text-violet-300 transition-all hover:border-violet-400 hover:bg-violet-500/20"
    >
      ✏️ Edit Subtitles
    </button>
    <button
      onClick={onOpenCropEditor}
      className="flex-1 rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-medium text-green-300 transition-all hover:border-green-400 hover:bg-green-500/20"
    >
      ✂️ Adjust Crop
    </button>
  </div>
</div>
```

- [ ] **Step 3: Verify in browser**

Navigate to the reveal step. The "Want to fine-tune?" section with two buttons should appear below "Try another clip". Clicking them does nothing yet (handlers not wired in page.tsx until Task 5).

- [ ] **Step 4: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/demo/RevealPanel.tsx
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: add fine-tune section to RevealPanel with subtitle and crop buttons"
```

---

## Task 4: Create useDemoCropEditor hook

**Files:**
- Create: `frontend/src/app/components/demo/useDemoCropEditor.ts`

- [ ] **Step 1: Create the hook file**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { CropBox, DragMode, DragTarget, StackedConfig } from "../../types";

const DEFAULT_CROP: StackedConfig = {
  top_crop: { x: 0, y: 0, w: 1920, h: 540 },
  bottom_crop: { x: 0, y: 540, w: 1920, h: 540 },
  split_ratio_top: 0.5,
};

type VideoDimensions = { width: number; height: number };

type DragState = {
  target: DragTarget;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startBox: CropBox;
} | null;

function clampBox(box: CropBox, vw: number, vh: number): CropBox {
  const x = Math.max(0, Math.min(box.x, vw - box.w));
  const y = Math.max(0, Math.min(box.y, vh - box.h));
  const w = Math.max(80, Math.min(box.w, vw - x));
  const h = Math.max(80, Math.min(box.h, vh - y));
  return { x, y, w, h };
}

export function useDemoCropEditor(clipIndex: number | null, isOpen: boolean) {
  const [cropDraft, setCropDraft] = useState<StackedConfig>(DEFAULT_CROP);
  const [videoDim, setVideoDim] = useState<VideoDimensions>({ width: 1920, height: 1080 });

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<DragState>(null);

  // Load crop.json for the selected clip when editor opens
  useEffect(() => {
    if (!isOpen || clipIndex === null) return;
    fetch(`/demo_cache/clip${clipIndex + 1}/crop.json`)
      .then((r) => r.json())
      .then((data: StackedConfig) => setCropDraft(data))
      .catch(() => setCropDraft(DEFAULT_CROP));
  }, [isOpen, clipIndex]);

  // Global pointer move/up handlers for drag
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const container = previewContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // Video renders full-width h-auto inside container
      const renderedW = rect.width;
      const renderedH = renderedW * (videoDim.height / videoDim.width);
      const scaleX = videoDim.width / renderedW;
      const scaleY = videoDim.height / renderedH;

      const dx = (e.clientX - drag.startClientX) * scaleX;
      const dy = (e.clientY - drag.startClientY) * scaleY;
      const b = drag.startBox;

      let updated: CropBox;
      if (drag.mode === "move") {
        updated = clampBox({ ...b, x: b.x + dx, y: b.y + dy }, videoDim.width, videoDim.height);
      } else {
        updated = clampBox(
          { x: b.x, y: b.y, w: Math.max(80, b.w + dx), h: Math.max(80, b.h + dy) },
          videoDim.width,
          videoDim.height,
        );
      }

      setCropDraft((prev) =>
        drag.target === "top_crop"
          ? { ...prev, top_crop: updated }
          : { ...prev, bottom_crop: updated },
      );
    }

    function onPointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [videoDim]);

  function handleLoadedMetadata(video: HTMLVideoElement) {
    if (video.videoWidth > 0) {
      setVideoDim({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  function handleLoadedData(video: HTMLVideoElement) {
    if (video.videoWidth > 0) {
      setVideoDim({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  function handleStartDrag(
    e: React.PointerEvent,
    target: DragTarget,
    mode: DragMode,
  ) {
    e.preventDefault();
    const box = target === "top_crop" ? cropDraft.top_crop : cropDraft.bottom_crop;
    dragRef.current = {
      target,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...box },
    };
  }

  function handleUpdateSplitRatio(value: number) {
    setCropDraft((prev) => ({ ...prev, split_ratio_top: value }));
  }

  function boxToStyle(box: CropBox): React.CSSProperties {
    const { width, height } = videoDim;
    return {
      left: `${(box.x / width) * 100}%`,
      top: `${(box.y / height) * 100}%`,
      width: `${(box.w / width) * 100}%`,
      height: `${(box.h / height) * 100}%`,
    };
  }

  return {
    cropDraft,
    previewContainerRef,
    videoRef,
    topPreviewStyle: boxToStyle(cropDraft.top_crop),
    bottomPreviewStyle: boxToStyle(cropDraft.bottom_crop),
    onLoadedMetadata: handleLoadedMetadata,
    onLoadedData: handleLoadedData,
    onStartDrag: handleStartDrag,
    onUpdateSplitRatio: handleUpdateSplitRatio,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from `useDemoCropEditor.ts`.

- [ ] **Step 3: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/demo/useDemoCropEditor.ts
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: add useDemoCropEditor hook for demo crop editor state"
```

---

## Task 5: Wire tool modals into page.tsx

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Add new imports**

Add to the existing import block:

```typescript
import { useState, useRef, useEffect } from "react";
import { CropEditorModal } from "./components/CropEditorModal";
import { SubtitleEditorModal } from "./components/SubtitleEditorModal";
import { useDemoCropEditor } from "./components/demo/useDemoCropEditor";
import type { EditableCaptionDraft } from "./types";
```

Note: `useRef` and `useEffect` are already imported via `"react"` — just ensure `useEffect` is in the destructure alongside the existing `useRef` and `useState`.

- [ ] **Step 2: Add demo tool state to the Home component**

After the existing state declarations, add:

```typescript
const [subtitleEditorOpen, setSubtitleEditorOpen] = useState(false);
const [cropEditorOpen, setCropEditorOpen] = useState(false);
const [demoCaptions, setDemoCaptions] = useState<EditableCaptionDraft[]>([]);
const [isApplyingSubtitles, setIsApplyingSubtitles] = useState(false);
```

- [ ] **Step 3: Load captions when subtitle editor opens**

After the state declarations, add:

```typescript
useEffect(() => {
  if (!subtitleEditorOpen || selectedClipIndex === null) return;
  fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
    .then((r) => r.json())
    .then((data: EditableCaptionDraft[]) => setDemoCaptions(data))
    .catch(() => setDemoCaptions([]));
}, [subtitleEditorOpen, selectedClipIndex]);
```

- [ ] **Step 4: Instantiate the crop editor hook**

After the state declarations:

```typescript
const cropEditor = useDemoCropEditor(selectedClipIndex, cropEditorOpen);
```

- [ ] **Step 5: Wire RevealPanel props**

Update the `<RevealPanel>` JSX to pass the two new handlers:

```typescript
<RevealPanel
  outputUrl={outputUrl}
  onReset={handleReset}
  onOpenSubtitleEditor={() => setSubtitleEditorOpen(true)}
  onOpenCropEditor={() => setCropEditorOpen(true)}
/>
```

- [ ] **Step 6: Mount CropEditorModal**

At the bottom of the returned JSX, just before the closing `</main>`, add:

```typescript
<CropEditorModal
  aiCropReasoning={null}
  aiCropStatus={null}
  bottomPreviewStyle={cropEditor.bottomPreviewStyle}
  cropDraft={cropEditor.cropDraft}
  cropEditorPreviewUrl={
    selectedClipIndex !== null ? `/clips/clip${selectedClipIndex + 1}.mp4` : null
  }
  cropSource="manual"
  hideModeBadge={true}
  isOpen={cropEditorOpen}
  isPostRenderMode={true}
  uiMode="non_ai"
  onClose={() => setCropEditorOpen(false)}
  onLoadedData={cropEditor.onLoadedData}
  onLoadedMetadata={cropEditor.onLoadedMetadata}
  onSave={() => setCropEditorOpen(false)}
  onStartDrag={cropEditor.onStartDrag}
  onUpdateSplitRatio={cropEditor.onUpdateSplitRatio}
  previewContainerRef={cropEditor.previewContainerRef}
  topPreviewStyle={cropEditor.topPreviewStyle}
  videoRef={cropEditor.videoRef}
/>
```

- [ ] **Step 7: Mount SubtitleEditorModal**

Also just before `</main>`:

```typescript
<SubtitleEditorModal
  captions={demoCaptions}
  isApplying={isApplyingSubtitles}
  isOpen={subtitleEditorOpen}
  onAddCaption={() => {
    const maxId = demoCaptions.reduce((m, c) => Math.max(m, c.id), 0);
    setDemoCaptions((prev) => [
      ...prev,
      {
        id: maxId + 1,
        start: 0,
        end: 1,
        raw_text: "",
        refined_text: "",
        final_text: "",
        status: "draft",
        is_manual: true,
        style: { color: "#FFFFFF", font_family: "Montserrat", font_size: 140, outline: 8, shadow: 3 },
        placement: { track: "bottom", x: null, y: null, align: "bottom" },
      },
    ]);
  }}
  onApply={() => {
    // In demo mode: apply triggers a backend re-render if available.
    // For now, close the editor — user can extend this when backend is wired.
    setSubtitleEditorOpen(false);
  }}
  onChangeCaption={(index, field, value) => {
    setDemoCaptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }}
  onChangePlacement={(index, field, value) => {
    setDemoCaptions((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        placement: { ...next[index].placement, [field]: value },
      };
      return next;
    });
  }}
  onChangeTiming={(index, start, end) => {
    setDemoCaptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], start, end };
      return next;
    });
  }}
  onChangeStyle={(index, field, value) => {
    setDemoCaptions((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        style: { ...next[index].style, [field]: value },
      };
      return next;
    });
  }}
  onClose={() => setSubtitleEditorOpen(false)}
  onDeleteCaption={(id) =>
    setDemoCaptions((prev) => prev.filter((c) => c.id !== id))
  }
  onReset={() => {
    if (selectedClipIndex === null) return;
    fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
      .then((r) => r.json())
      .then((data: EditableCaptionDraft[]) => setDemoCaptions(data));
  }}
  onSave={() => setSubtitleEditorOpen(false)}
  outputVideoUrl={outputUrl}
/>
```

- [ ] **Step 8: Verify TypeScript and both modals open**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend && npx tsc --noEmit 2>&1 | head -30
```

Then in browser: complete the demo flow → reach the reveal step → click "Edit Subtitles" → modal opens showing the placeholder caption → click "Adjust Crop" → crop editor opens showing the clip with two draggable boxes.

- [ ] **Step 9: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/page.tsx
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: wire subtitle and crop editor modals into demo reveal step"
```

---

## Task 6: Live CSS subtitle overlay in SubtitleEditorModal

**Files:**
- Modify: `frontend/src/app/components/SubtitleEditorModal.tsx`

- [ ] **Step 1: Add the overlay component inside SubtitleEditorModal**

Locate the `<div className="mt-4 flex min-h-[420px] items-center justify-center ...">` that wraps the preview video. Wrap the `<video>` in a relative container and add the overlay div:

Replace the preview section (the `min-h-[420px]` div's inner content) with:

```typescript
{outputVideoUrl ? (
  <div className="relative">
    <video
      ref={videoRef}
      key={outputVideoUrl}
      controls
      className="max-h-[620px] rounded-2xl border border-zinc-800"
      src={outputVideoUrl}
      onTimeUpdate={() => {
        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
      }}
      onLoadedMetadata={() => {
        if (videoRef.current) setVideoDuration(videoRef.current.duration);
      }}
    />
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {captions
        .filter((c) => currentTime >= c.start && currentTime < c.end)
        .map((c) => {
          const isTop = c.placement.track === "top";
          const isBottom = c.placement.track === "bottom";
          return (
            <div
              key={c.id}
              className="absolute left-0 right-0 px-3 text-center"
              style={{
                top: isTop ? "8%" : undefined,
                bottom: isBottom ? "8%" : undefined,
                ...(c.placement.track === "free" && c.placement.y != null
                  ? { top: `${c.placement.y}%` }
                  : {}),
                color: c.style.color,
                fontFamily: c.style.font_family,
                fontSize: `${Math.min(c.style.font_size / 4, 48)}px`,
                fontWeight: 900,
                lineHeight: 1.2,
                textShadow: `0 0 ${Math.max(1, c.style.shadow)}px rgba(0,0,0,0.95), 0 0 ${Math.max(1, c.style.outline)}px rgba(0,0,0,0.95)`,
                textAlign:
                  c.placement.align === "top" || c.placement.align === "bottom"
                    ? "center"
                    : "center",
              }}
            >
              {c.final_text}
            </div>
          );
        })}
    </div>
  </div>
) : (
  <div className="text-sm text-zinc-500">No preview video available.</div>
)}
```

Note: `font_size` is scaled down (`/ 4`) because the original value (e.g. 140) is an FFmpeg pixel size for a 1080px-wide video. The preview video is ~300px wide, so dividing by ~4 approximates the right visual scale.

- [ ] **Step 2: Verify the overlay**

In browser: open the subtitle editor with a caption that has `start: 0, end: 3`. Play the video from 0s — the caption text should appear overlaid on the video for the first 3 seconds, then disappear. Changing `font_family` or `color` in the caption card should update the overlay in real-time (no re-render needed).

- [ ] **Step 3: Commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/SubtitleEditorModal.tsx
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: add live CSS subtitle overlay to subtitle editor preview"
```

---

## Task 7: SubtitleTimeline — zoom, waveform, and resizable height

This task modifies two files. Do them in order.

**Files:**
- Modify: `frontend/src/app/components/SubtitleEditorModal.tsx`
- Modify: `frontend/src/app/components/SubtitleTimeline.tsx`

### 7a — Add audio extraction and resize handle to SubtitleEditorModal

- [ ] **Step 1: Add audioPeaks state and extraction logic**

In `SubtitleEditorModal`, add a new state and a `useEffect` that extracts audio peaks when the video URL changes. Add after the existing state declarations:

```typescript
const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
const [timelineHeight, setTimelineHeight] = useState(128);
const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
```

Add this `useEffect` (after the existing ones):

```typescript
useEffect(() => {
  if (!outputVideoUrl) return;
  let cancelled = false;

  async function extractPeaks() {
    try {
      const audioCtx = new AudioContext();
      const response = await fetch(outputVideoUrl!);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (cancelled) return;
      const data = audioBuffer.getChannelData(0);
      const NUM_BARS = 200;
      const blockSize = Math.floor(data.length / NUM_BARS);
      const peaks: number[] = [];
      for (let i = 0; i < NUM_BARS; i++) {
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(data[i * blockSize + j] ?? 0);
          if (abs > max) max = abs;
        }
        peaks.push(max);
      }
      setAudioPeaks(peaks);
    } catch {
      // Audio extraction is best-effort — fail silently
      setAudioPeaks([]);
    }
  }

  void extractPeaks();
  return () => { cancelled = true; };
}, [outputVideoUrl]);
```

- [ ] **Step 2: Add timeline resize handle**

In the timeline section (the `<div className="flex-shrink-0 border-t border-zinc-800">` near the bottom), replace the snap controls row with a handle + snap controls combined:

Before the `<SubtitleTimeline .../>` call, insert:

```typescript
<div
  className="flex cursor-ns-resize items-center justify-center border-b border-zinc-800 bg-zinc-900/60 py-0.5 select-none"
  onPointerDown={(e) => {
    resizeDragRef.current = { startY: e.clientY, startHeight: timelineHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  }}
  onPointerMove={(e) => {
    if (!resizeDragRef.current) return;
    const delta = resizeDragRef.current.startY - e.clientY;
    setTimelineHeight(Math.max(80, Math.min(320, resizeDragRef.current.startHeight + delta)));
  }}
  onPointerUp={() => { resizeDragRef.current = null; }}
>
  <div className="h-1 w-8 rounded-full bg-zinc-700" />
</div>
```

- [ ] **Step 3: Pass audioPeaks and height to SubtitleTimeline**

Update the `<SubtitleTimeline .../>` call to include the two new props:

```typescript
<SubtitleTimeline
  audioPeaks={audioPeaks}
  captions={captions}
  currentTime={currentTime}
  disabled={isApplying}
  duration={videoDuration}
  height={timelineHeight}
  selectedId={selectedCaptionId}
  snapInterval={snapInterval}
  onChange={handleTimelineChange}
  onSeek={handleSeek}
  onSelect={setSelectedCaptionId}
/>
```

### 7b — Upgrade SubtitleTimeline

- [ ] **Step 4: Update SubtitleTimelineProps**

Add the two new props to the type:

```typescript
type SubtitleTimelineProps = {
  audioPeaks?: number[];
  captions: EditableCaptionDraft[];
  currentTime: number;
  disabled?: boolean;
  duration: number;
  height?: number;
  selectedId: number | null;
  snapInterval: number;
  onChange: (id: number, start: number, end: number) => void;
  onSeek: (time: number) => void;
  onSelect: (id: number) => void;
};
```

- [ ] **Step 5: Add zoom and scroll state**

After the existing `const containerRef` and `const dragRef`, add:

```typescript
const [zoom, setZoom] = useState(1);
const [scrollPx, setScrollPx] = useState(0);
const innerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 6: Update the component signature to accept new props**

```typescript
export function SubtitleTimeline({
  audioPeaks = [],
  captions,
  currentTime,
  disabled = false,
  duration,
  height = 128,
  selectedId,
  snapInterval,
  onChange,
  onSeek,
  onSelect,
}: SubtitleTimelineProps) {
```

- [ ] **Step 7: Replace the percentage-based layout helpers with pixel-based ones**

Replace the existing `pct` function and add zoom/scroll helpers:

```typescript
function totalWidth(): number {
  const el = containerRef.current;
  return el ? el.clientWidth * zoom : 600 * zoom;
}

function timeToPx(t: number): number {
  if (duration <= 0) return 0;
  return (t / duration) * totalWidth() - scrollPx;
}

function pxToTime(px: number): number {
  if (duration <= 0) return 0;
  return ((px + scrollPx) / totalWidth()) * duration;
}
```

- [ ] **Step 8: Add wheel handler for zoom**

Add this function inside the component (before the return):

```typescript
function handleWheel(e: React.WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.25 : 0.25;
  setZoom((z) => Math.max(1, Math.min(10, z + delta)));
}
```

- [ ] **Step 9: Update clientXToTime to use pixel layout**

Replace the existing `clientXToTime` with:

```typescript
const clientXToTime = useCallback((clientX: number): number => {
  const el = containerRef.current;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const relPx = clientX - rect.left;
  return clamp(pxToTime(relPx), 0, stateRef.current.duration);
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 10: Update pointer move handler to use pixel layout**

In the `handlePointerMove` inside the drag `useEffect`, replace the `dt` calculation:

```typescript
const el = containerRef.current;
if (!el) return;
const rect = el.getBoundingClientRect();
const tWidth = el.clientWidth * (stateRef.current as any).zoom ?? 600;
const dt = ((e.clientX - drag.startClientX) / tWidth) * duration;
```

Add `zoom` to `stateRef`:

```typescript
const stateRef = useRef({ captions, duration, snapInterval, onChange, onSeek, zoom });
stateRef.current = { captions, duration, snapInterval, onChange, onSeek, zoom };
```

And update the `dt` line in `handlePointerMove`. Also update the `stateRef` definition and assignment line to include `zoom`:

```typescript
// Updated stateRef (replace the existing two lines near the top of the component)
const stateRef = useRef({ captions, duration, snapInterval, onChange, onSeek, zoom });
stateRef.current = { captions, duration, snapInterval, onChange, onSeek, zoom };

// Updated dt in handlePointerMove (inside the drag useEffect)
const tWidth = el.clientWidth * stateRef.current.zoom;
const dt = ((e.clientX - drag.startClientX) / tWidth) * duration;
```

- [ ] **Step 11: Update renderBlock to use pixel positions**

Replace the `widthPct` / `left: pct(...)` approach with pixel values:

```typescript
function renderBlock(caption: EditableCaptionDraft) {
  const isSelected = caption.id === selectedId;
  const isBottom = caption.placement.track === "bottom";

  const blockCls = isBottom
    ? isSelected
      ? "bg-amber-400 border-amber-200 text-amber-950 ring-1 ring-amber-300"
      : "bg-amber-600/75 border-amber-400/70 text-amber-50"
    : isSelected
    ? "bg-violet-400 border-violet-200 text-violet-950 ring-1 ring-violet-300"
    : "bg-violet-600/75 border-violet-400/70 text-violet-50";

  const leftPx = timeToPx(caption.start);
  const widthPx =
    duration > 0 ? Math.max(6, ((caption.end - caption.start) / duration) * totalWidth()) : 0;

  if (widthPx < 1) return null;

  const tooltip = `${caption.final_text || "(empty)"}\n${caption.start.toFixed(2)}s – ${caption.end.toFixed(2)}s`;

  return (
    <div
      key={caption.id}
      title={tooltip}
      className={`absolute top-1.5 bottom-1.5 rounded-md border-2 overflow-hidden shadow shadow-black/50 ${blockCls} ${
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
      style={{ left: leftPx, width: widthPx, minWidth: 6 }}
      onPointerDown={(e) => startBlockDrag(e, caption, "move")}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/25 z-10 flex items-center justify-center"
        onPointerDown={(e) => startBlockDrag(e, caption, "resize-start")}
      >
        <div className="w-0.5 h-3 rounded-full bg-current opacity-40 pointer-events-none" />
      </div>
      <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 truncate px-1 text-[10px] font-medium leading-none pointer-events-none select-none">
        {caption.final_text || "…"}
      </span>
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/25 z-10 flex items-center justify-center"
        onPointerDown={(e) => startBlockDrag(e, caption, "resize-end")}
      >
        <div className="w-0.5 h-3 rounded-full bg-current opacity-40 pointer-events-none" />
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Update the ruler ticks to use pixel positions**

Replace the ticks `<div>` inside the ruler to use `timeToPx`:

```typescript
{ticks.map((t) => (
  <div
    key={t}
    className="absolute top-0 flex flex-col items-center pointer-events-none"
    style={{ left: timeToPx(t), transform: "translateX(-50%)" }}
  >
    <div className="h-2 w-px bg-zinc-600" />
    <span className="text-[9px] text-zinc-500 leading-none mt-px">
      {formatRulerTime(t)}
    </span>
  </div>
))}
```

- [ ] **Step 13: Update playhead to use pixel position**

Replace `style={{ left: playheadPos }}` with `style={{ left: timeToPx(currentTime) }}` in all three playhead elements.

- [ ] **Step 14: Update the outer container JSX**

Replace the outer `<div ref={containerRef} ...>` with a version that handles wheel zoom and pan, and wraps content in a scrollable inner div. Also add the zoom controls bar and waveform SVG.

Replace the entire return statement with:

```typescript
if (duration <= 0) {
  return (
    <div className="flex items-center justify-center bg-zinc-950 text-xs text-zinc-600" style={{ height }}>
      Load a video to enable the timeline.
    </div>
  );
}

const trackH = Math.floor((height - 24) / 2); // ruler = 24px, two tracks split rest

return (
  <div
    ref={containerRef}
    className={`relative w-full select-none overflow-hidden bg-zinc-950 ${disabled ? "pointer-events-none opacity-50" : ""}`}
    style={{ height }}
    onWheel={handleWheel}
  >
    {/* Zoom controls */}
    <div className="absolute right-2 top-1 z-20 flex items-center gap-1">
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800"
        onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
      >−</button>
      <span className="text-[10px] text-zinc-600 font-mono">{zoom.toFixed(1)}×</span>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800"
        onClick={() => setZoom((z) => Math.min(10, z + 0.5))}
      >+</button>
    </div>

    {/* Ruler — also handles pan drag */}
    <div
      className="relative border-b border-zinc-800 bg-zinc-900/60 cursor-crosshair overflow-hidden"
      style={{ height: 24 }}
      onPointerDown={(e) => startSeekDrag(e.clientX)}
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 flex flex-col items-center pointer-events-none"
          style={{ left: timeToPx(t), transform: "translateX(-50%)" }}
        >
          <div className="h-2 w-px bg-zinc-600" />
          <span className="text-[9px] text-zinc-500 leading-none mt-px">
            {formatRulerTime(t)}
          </span>
        </div>
      ))}
      <div className="absolute top-0 z-20 pointer-events-none" style={{ left: timeToPx(currentTime), transform: "translateX(-50%)" }}>
        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-500" />
      </div>
      <div className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10" style={{ left: timeToPx(currentTime) }} />
    </div>

    {/* Top track */}
    <div
      className="relative border-b border-zinc-800/60 cursor-crosshair overflow-hidden"
      style={{ height: trackH }}
      onPointerDown={(e) => startSeekDrag(e.clientX)}
    >
      <span className="absolute left-1.5 top-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-700 pointer-events-none z-10">
        Top / Free
      </span>
      {/* Waveform */}
      {audioPeaks.length > 0 && (
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" preserveAspectRatio="none">
          {audioPeaks.map((peak, i) => {
            const x = (i / audioPeaks.length) * totalWidth() - scrollPx;
            const barH = peak * trackH;
            return (
              <rect
                key={i}
                x={x}
                y={(trackH - barH) / 2}
                width={Math.max(1, totalWidth() / audioPeaks.length - 1)}
                height={barH}
                fill="#9146ff"
              />
            );
          })}
        </svg>
      )}
      {topCaptions.map(renderBlock)}
      <div className="absolute top-0 bottom-0 w-px bg-red-500/60 pointer-events-none z-10" style={{ left: timeToPx(currentTime) }} />
    </div>

    {/* Bottom track */}
    <div
      className="relative cursor-crosshair overflow-hidden"
      style={{ height: trackH }}
      onPointerDown={(e) => startSeekDrag(e.clientX)}
    >
      <span className="absolute left-1.5 top-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-700 pointer-events-none z-10">
        Bottom
      </span>
      {audioPeaks.length > 0 && (
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" preserveAspectRatio="none">
          {audioPeaks.map((peak, i) => {
            const x = (i / audioPeaks.length) * totalWidth() - scrollPx;
            const barH = peak * trackH;
            return (
              <rect
                key={i}
                x={x}
                y={(trackH - barH) / 2}
                width={Math.max(1, totalWidth() / audioPeaks.length - 1)}
                height={barH}
                fill="#9146ff"
              />
            );
          })}
        </svg>
      )}
      {bottomCaptions.map(renderBlock)}
      <div className="absolute top-0 bottom-0 w-px bg-red-500/60 pointer-events-none z-10" style={{ left: timeToPx(currentTime) }} />
    </div>
  </div>
);
```

- [ ] **Step 15: Verify TypeScript compiles**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before proceeding.

- [ ] **Step 16: Verify timeline in browser**

Open the subtitle editor. With a video loaded:
1. Scroll wheel on the timeline should zoom in/out (caption blocks get wider/narrower)
2. The +/− buttons should also zoom
3. If the video has audio, waveform bars should appear after a few seconds (audio extraction is async)
4. Drag the resize handle (above the timeline) up/down — timeline panel height should change
5. Caption blocks should still be draggable and snap correctly

- [ ] **Step 17: Final commit**

```bash
git -C /home/jirod/repos/twitchtok-showcase add \
  frontend/src/app/components/SubtitleEditorModal.tsx \
  frontend/src/app/components/SubtitleTimeline.tsx
git -C /home/jirod/repos/twitchtok-showcase commit -m "feat: timeline zoom, audio waveform, resize handle, and live subtitle overlay"
```
