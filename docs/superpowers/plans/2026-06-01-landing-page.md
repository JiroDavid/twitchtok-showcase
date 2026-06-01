# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TwitchTok showcase landing page -- a four-step demo flow (pick clip, configure, process, reveal) with a persistent mini phone preview and a full-width reveal panel.

**Architecture:** Orchestrator `page.tsx` owns all state and passes props to six focused demo components. The existing editor is moved to `/app` untouched. No new backend endpoints -- the demo calls the same `POST /jobs/process-video` and `GET /jobs/{job_id}` the editor already uses.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, FastAPI backend at `http://localhost:8000` proxied via Next.js rewrites.

---

## File map

| Action | Path |
|--------|------|
| Move (update imports only) | `src/app/page.tsx` → `src/app/app/page.tsx` |
| Update | `src/app/layout.tsx` |
| Update | `src/app/globals.css` |
| Create | `src/app/faq/page.tsx` |
| Create | `src/app/components/Nav.tsx` |
| Create | `src/app/components/demo/demoClips.ts` |
| Update | `src/app/types.ts` |
| Create | `src/app/components/demo/DemoHero.tsx` |
| Create | `src/app/components/demo/ClipPicker.tsx` |
| Create | `src/app/components/demo/MiniPhonePreview.tsx` |
| Create | `src/app/components/demo/StyleConfigurator.tsx` |
| Create | `src/app/components/demo/ProcessingWindow.tsx` |
| Create | `src/app/components/demo/RevealPanel.tsx` |
| Create | `src/app/page.tsx` (new landing orchestrator) |

---

## Task 1: Move existing editor to /app

**Files:**
- Move: `src/app/page.tsx` → `src/app/app/page.tsx`

The existing editor file is moved verbatim. Only the import paths for components, types, and utils change from relative-to-root to one level deeper.

- [ ] **Step 1: Create the /app directory and copy the file**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
mkdir -p src/app/app
cp src/app/page.tsx src/app/app/page.tsx
```

- [ ] **Step 2: Update all import paths in `src/app/app/page.tsx`**

There are four groups of imports that use `./` prefixes. Replace them all:

```bash
sed -i \
  -e 's|from "\./components/|from "../components/|g' \
  -e 's|from "\./types"|from "../types"|g' \
  -e 's|from "\./utils"|from "../utils"|g' \
  src/app/app/page.tsx
```

- [ ] **Step 3: Verify the imports compiled correctly**

Open `src/app/app/page.tsx` and confirm the first import block reads:

```typescript
import { AccountPanel } from "../components/AccountPanel";
import { ConfigureHighlightModal } from "../components/ConfigureHighlightModal";
import { CropEditorModal } from "../components/CropEditorModal";
import { DownloadedFilesPanel } from "../components/DownloadedFilesPanel";
import { EditorControlsPanel } from "../components/EditorControlsPanel";
import { JobActivityPanel } from "../components/JobActivityPanel";
import { OutputPreviewPanel } from "../components/OutputPreviewPanel";
import { SubtitleEditorModal } from "../components/SubtitleEditorModal";
import { TwitchClipsPanel } from "../components/TwitchClipsPanel";
import { TwitchUrlPanel } from "../components/TwitchUrlPanel";
import type { ... } from "../types";
import { clamp, roundBox } from "../utils";
```

- [ ] **Step 4: Delete the old root page.tsx (we will replace it in Task 10)**

Do NOT delete it yet -- leave it in place. The new landing `page.tsx` will overwrite it in Task 10. Moving now would leave the app with no root route and cause a build error.

- [ ] **Step 5: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds. The `/app` route now serves the existing editor; `/` still serves the old editor (temporarily, until Task 10 replaces it).

- [ ] **Step 6: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/app/
git commit -m "feat: add /app route with existing editor"
```

---

## Task 2: Globals, layout, Nav, FAQ stub

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/app/components/Nav.tsx`
- Create: `src/app/faq/page.tsx`

- [ ] **Step 1: Update `src/app/globals.css`**

Replace the entire file contents:

```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --color-twitch: #9146FF;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

/* Clip card audio-bar animation */
@keyframes audio-bar {
  from { transform: scaleY(0.4); }
  to   { transform: scaleY(1.2); }
}

.animate-audio-bar {
  animation: audio-bar 0.6s ease-in-out infinite alternate;
  transform-origin: bottom;
}

/* Phone reveal entrance animation */
@keyframes reveal-phone {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
}

.animate-reveal-phone {
  animation: reveal-phone 0.4s ease-out forwards;
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Barlow_Condensed } from "next/font/google";
import { Nav } from "./components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "TwitchTok - AI-Powered Twitch Clip Editor",
  description: "Turn Twitch clips into viral vertical shorts in seconds",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `src/app/components/Nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Demo", href: "/" },
  { label: "App", href: "/app" },
  { label: "FAQ", href: "/faq" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-[#9146FF]" />
          <span className="font-bold text-zinc-100">TwitchTok</span>
        </Link>
        <div className="flex gap-6">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors ${
                  isActive
                    ? "border-b-2 border-[#9146FF] pb-0.5 font-semibold text-[#9146FF]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/app/faq/page.tsx`**

```tsx
export default function FAQPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-100">FAQ</h1>
      <p className="mt-4 text-zinc-400">Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds. Nav appears on all pages including the existing editor at `/app`.

- [ ] **Step 6: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/globals.css frontend/src/app/layout.tsx \
        frontend/src/app/components/Nav.tsx frontend/src/app/faq/
git commit -m "feat: add Nav, update globals with twitch purple, add FAQ stub"
```

---

## Task 3: Demo types and clip constants

**Files:**
- Modify: `src/app/types.ts`
- Create: `src/app/components/demo/demoClips.ts`

- [ ] **Step 1: Add demo types to `src/app/types.ts`**

Append to the end of the existing `src/app/types.ts` file:

```typescript
// --- Demo landing page types ---

export type DemoStage = "pick" | "configure" | "processing" | "reveal";

export type DemoConfig = {
  font: HighlightFontOption;
  color: string;
  layout: LayoutOption;
};

export type DemoClip = {
  title: string;
  streamer: string;
  duration: string;
  videoSrc: string;
  inputPath: string;
};
```

- [ ] **Step 2: Create `src/app/components/demo/demoClips.ts`**

```typescript
import type { DemoClip } from "../../types";

// Fill in videoSrc and inputPath when real clips are chosen before the show.
// videoSrc: the URL the browser fetches, e.g. "/storage/downloads/clip1.mp4"
// inputPath: the path the backend uses, e.g. "backend/storage/downloads/clip1.mp4"
export const DEMO_CLIPS: DemoClip[] = [
  {
    title: "Insane clutch moment",
    streamer: "Clip 1",
    duration: "0:42",
    videoSrc: "",
    inputPath: "",
  },
  {
    title: "Unexpected reaction",
    streamer: "Clip 2",
    duration: "0:38",
    videoSrc: "",
    inputPath: "",
  },
  {
    title: "Highlight reel",
    streamer: "Clip 3",
    duration: "1:02",
    videoSrc: "",
    inputPath: "",
  },
];
```

- [ ] **Step 3: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds (no changes to runtime behaviour yet).

- [ ] **Step 4: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/types.ts frontend/src/app/components/demo/
git commit -m "feat: add demo types and clip placeholder constants"
```

---

## Task 4: DemoHero component

**Files:**
- Create: `src/app/components/demo/DemoHero.tsx`

- [ ] **Step 1: Create `src/app/components/demo/DemoHero.tsx`**

```tsx
export function DemoHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-20 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1c1020] via-zinc-950 to-zinc-950" />
      <div className="relative">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9146FF]">
          AI-Powered Short-Form Video
        </p>
        <h1 className="text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Turn Twitch clips
          <br />
          <span className="text-[#9146FF]">into viral shorts</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-500">in seconds, automatically</p>
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <span>&#8595;</span>
          <span>Pick a clip below to try it live</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/DemoHero.tsx
git commit -m "feat: add DemoHero component"
```

---

## Task 5: ClipPicker component

**Files:**
- Create: `src/app/components/demo/ClipPicker.tsx`

- [ ] **Step 1: Create `src/app/components/demo/ClipPicker.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { DEMO_CLIPS } from "./demoClips";

const PLACEHOLDER_GRADIENTS = [
  "bg-gradient-to-br from-purple-950 to-zinc-900",
  "bg-gradient-to-br from-blue-950 to-zinc-900",
  "bg-gradient-to-br from-green-950 to-zinc-900",
];

type ClipPickerProps = {
  selectedClipIndex: number | null;
  onSelect: (index: number) => void;
};

export function ClipPicker({ selectedClipIndex, onSelect }: ClipPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null]);

  function handleMouseEnter(index: number) {
    setHoveredIndex(index);
    const video = videoRefs.current[index];
    if (video) video.muted = false;
  }

  function handleMouseLeave(index: number) {
    setHoveredIndex(null);
    if (index !== selectedClipIndex) {
      const video = videoRefs.current[index];
      if (video) video.muted = true;
    }
  }

  return (
    <section className="px-6 py-12">
      <div className="flex items-end justify-center gap-5">
        {DEMO_CLIPS.map((clip, index) => {
          const isSelected = selectedClipIndex === index;
          const isActive = hoveredIndex === index || isSelected;

          return (
            <div
              key={index}
              className={`relative w-48 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150 ease-out
                ${isActive
                  ? "scale-105 -translate-y-1 border-[#9146FF] shadow-[0_0_24px_rgba(145,70,255,0.35)]"
                  : "border-zinc-700 hover:border-zinc-500"
                }`}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={() => handleMouseLeave(index)}
              onClick={() => onSelect(index)}
            >
              {isSelected && (
                <div className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#9146FF]">
                  <span className="text-[10px] font-bold text-white">&#10003;</span>
                </div>
              )}

              <div className="relative h-28 bg-zinc-800">
                {clip.videoSrc ? (
                  <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    src={clip.videoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className={`h-full w-full ${PLACEHOLDER_GRADIENTS[index]}`} />
                )}

                <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200">
                  {clip.duration}
                </div>
                <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />

                {isActive && (
                  <div className="absolute bottom-2 right-2 flex items-end gap-0.5">
                    {[6, 10, 7, 12].map((h, i) => (
                      <div
                        key={i}
                        className="animate-audio-bar w-0.5 rounded-sm bg-[#9146FF]"
                        style={{ height: h, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 p-2.5">
                <p className={`text-[11px] font-semibold ${isActive ? "text-zinc-100" : "text-zinc-400"}`}>
                  {clip.title}
                </p>
                <p className={`mt-0.5 text-[10px] ${isActive ? "text-[#9146FF]" : "text-zinc-600"}`}>
                  {isSelected ? "Selected ✓" : isActive ? "▶ Playing with audio" : "▶ Auto-playing"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/ClipPicker.tsx
git commit -m "feat: add ClipPicker with hover-expand and audio-unmute"
```

---

## Task 6: MiniPhonePreview component

**Files:**
- Create: `src/app/components/demo/MiniPhonePreview.tsx`

- [ ] **Step 1: Create `src/app/components/demo/MiniPhonePreview.tsx`**

```tsx
import type { DemoConfig } from "../../types";
import type { HighlightFontOption } from "../../types";

// Approximations for fonts that are not available as Google Fonts.
// Montserrat and Barlow Condensed are loaded as Google Fonts and match exactly.
const FONT_FAMILY_MAP: Record<HighlightFontOption, string> = {
  Montserrat: "var(--font-montserrat), sans-serif",
  "Barlow Condensed": "var(--font-barlow-condensed), sans-serif",
  Gibson: "var(--font-geist-sans), sans-serif",
  "Komika Axis": "Impact, 'Arial Black', sans-serif",
  Futura: "'Century Gothic', 'Trebuchet MS', sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
};

type MiniPhonePreviewProps = {
  config: DemoConfig;
  selectedClipIndex: number | null;
};

export function MiniPhonePreview({ config, selectedClipIndex }: MiniPhonePreviewProps) {
  return (
    <div className="sticky top-8 text-center">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
        Live Preview
      </p>

      <div className="mx-auto w-[76px] rounded-[14px] border-2 border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
        <div className="flex h-2 items-center justify-center rounded-t-sm bg-zinc-800">
          <div className="h-0.5 w-3.5 rounded-full bg-zinc-700" />
        </div>

        <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "9 / 16" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1020] to-zinc-950" />
          {selectedClipIndex !== null && (
            <div className="absolute bottom-0 left-0 right-0 p-1">
              <div
                className="rounded px-1 py-0.5 text-center text-[6px] font-extrabold uppercase tracking-wide text-white"
                style={{
                  backgroundColor: config.color === "#FFFFFF" ? "rgba(0,0,0,0.85)" : config.color,
                  fontFamily: FONT_FAMILY_MAP[config.font as HighlightFontOption],
                }}
              >
                Caption preview
              </div>
            </div>
          )}
        </div>

        <div className="mt-0.5 flex h-1.5 items-center justify-center rounded-b-sm bg-zinc-800">
          <div className="h-0.5 w-4 rounded-full bg-zinc-700" />
        </div>
      </div>

      <p className="mt-2 text-[9px] text-zinc-600">Updates live</p>
      <div className="mx-auto mt-2 h-4 w-px bg-gradient-to-b from-zinc-700 to-transparent" />
      <p className="mt-1 text-[8px] leading-tight text-zinc-700">
        expands at
        <br />
        Step 4
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/MiniPhonePreview.tsx
git commit -m "feat: add MiniPhonePreview with live font/colour preview"
```

---

## Task 7: StyleConfigurator component

**Files:**
- Create: `src/app/components/demo/StyleConfigurator.tsx`

- [ ] **Step 1: Create `src/app/components/demo/StyleConfigurator.tsx`**

```tsx
"use client";

import type { DemoConfig } from "../../types";
import type { HighlightFontOption, LayoutOption } from "../../types";

const FONT_OPTIONS: HighlightFontOption[] = [
  "Montserrat",
  "Barlow Condensed",
  "Gibson",
  "Komika Axis",
  "Futura",
  "Arial",
];

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#FFFFFF", label: "White" },
  { value: "#D4AF0D", label: "Gold" },
  { value: "#9146FF", label: "Purple" },
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
];

const LAYOUT_OPTIONS: { value: LayoutOption; label: string; description: string }[] = [
  { value: "cropped",    label: "Cropped",    description: "Center crop to 9:16" },
  { value: "fullscreen", label: "Fullscreen", description: "Blurred background" },
  { value: "stacked",    label: "Stacked",    description: "Facecam + gameplay" },
];

type StyleConfiguratorProps = {
  config: DemoConfig;
  onConfigChange: (config: DemoConfig) => void;
  selectedClipIndex: number | null;
  onGenerate: () => void;
};

export function StyleConfigurator({
  config,
  onConfigChange,
  selectedClipIndex,
  onGenerate,
}: StyleConfiguratorProps) {
  return (
    <div className="rounded-xl border-l-4 border-[#9146FF] bg-zinc-900 p-6">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 2 -- Customise
      </p>

      <div className="space-y-5">
        {/* Font */}
        <div>
          <label className="mb-2 block text-xs text-zinc-500">Font</label>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font}
                onClick={() => onConfigChange({ ...config, font })}
                className={`rounded-md px-3 py-1.5 text-xs transition-all duration-100 ${
                  config.font === font
                    ? "bg-[#9146FF] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                }`}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        {/* Colour */}
        <div>
          <label className="mb-2 block text-xs text-zinc-500">Caption colour</label>
          <div className="flex gap-3">
            {COLOR_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                title={label}
                onClick={() => onConfigChange({ ...config, color: value })}
                className={`h-6 w-6 rounded-full transition-all duration-100 ${
                  config.color === value
                    ? "scale-125 ring-2 ring-[#9146FF] ring-offset-2 ring-offset-zinc-900"
                    : "hover:scale-110"
                }`}
                style={{
                  backgroundColor: value,
                  border: value === "#FFFFFF" ? "1px solid #52525b" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Layout */}
        <div>
          <label className="mb-2 block text-xs text-zinc-500">Layout</label>
          <div className="flex gap-2">
            {LAYOUT_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => onConfigChange({ ...config, layout: value })}
                className={`flex-1 rounded-md px-3 py-2 text-left transition-all duration-100 ${
                  config.layout === value
                    ? "border border-[#9146FF] bg-[#9146FF]/10 text-zinc-100"
                    : "border border-zinc-800 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-[10px] text-zinc-500">{description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={selectedClipIndex === null}
        className="mt-6 w-full rounded-lg bg-[#9146FF] py-3 text-sm font-bold text-white shadow-[0_2px_12px_rgba(145,70,255,0.4)] transition-all hover:bg-[#7c3aed] hover:shadow-[0_4px_20px_rgba(145,70,255,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Generate Highlight
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/StyleConfigurator.tsx
git commit -m "feat: add StyleConfigurator with font/colour/layout controls"
```

---

## Task 8: ProcessingWindow component

**Files:**
- Create: `src/app/components/demo/ProcessingWindow.tsx`

- [ ] **Step 1: Create `src/app/components/demo/ProcessingWindow.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoConfig } from "../../types";
import type { JobCreateResponse, JobStatusResponse, ProcessJobResult } from "../../types";
import { DEMO_CLIPS } from "./demoClips";

const MESSAGES = [
  "Analysing video content...",
  "Whisper transcribing audio...",
  "Applying your style...",
  "Rendering vertical format...",
  "Finishing up...",
];

// Milliseconds after mount when each message becomes active
const MESSAGE_DELAYS_MS = [0, 1500, 3500, 5500, 7500];

type ProcessingWindowProps = {
  selectedClipIndex: number;
  config: DemoConfig;
  onComplete: (outputUrl: string) => void;
  onError: () => void;
};

export function ProcessingWindow({
  selectedClipIndex,
  config,
  onComplete,
  onError,
}: ProcessingWindowProps) {
  const [activeIndex, setActiveIndex]       = useState(0);
  const [doneIndices, setDoneIndices]       = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  // Refs let the polling closure read the latest state without stale captures
  const messagesFinishedRef = useRef(false);
  const jobOutputUrlRef     = useRef<string | null>(null);
  const onCompleteRef       = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Timed message sequence
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    MESSAGE_DELAYS_MS.forEach((delay, index) => {
      timers.push(
        setTimeout(() => {
          setActiveIndex(index);
          if (index > 0) {
            setDoneIndices((prev) => new Set([...prev, index - 1]));
          }

          if (index === MESSAGES.length - 1) {
            // Final message -- mark it done after 1 s then check if job is ready
            timers.push(
              setTimeout(() => {
                setDoneIndices((prev) => new Set([...prev, index]));
                messagesFinishedRef.current = true;
                if (jobOutputUrlRef.current) {
                  onCompleteRef.current(jobOutputUrlRef.current);
                }
              }, 1000),
            );
          }
        }, delay),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Backend job
  useEffect(() => {
    const inputPath = DEMO_CLIPS[selectedClipIndex]?.inputPath ?? "";
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function startJob() {
      try {
        const body = {
          input_path: inputPath,
          layout: config.layout,
          stacked_config: null,
          captions: {
            enabled: true,
            burn_in: true,
            refine_with_llm: false,
            censor_subtitles: false,
            default_style: {
              color: config.color,
              font_family: config.font,
              font_size: 140,
              outline: 8,
              shadow: 3,
            },
          },
          metadata: { enabled: false },
          crop_source: "manual",
        };

        const res = await fetch("/jobs/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Job creation failed (${res.status}): ${text}`);
        }

        const { job_id }: JobCreateResponse = await res.json();

        intervalId = setInterval(async () => {
          try {
            const statusRes = await fetch(`/jobs/${job_id}`);
            if (!statusRes.ok) throw new Error(`Poll failed: ${statusRes.status}`);

            const data: JobStatusResponse = await statusRes.json();

            if (data.status === "completed") {
              if (intervalId) clearInterval(intervalId);
              const result = data.result as ProcessJobResult | null;
              const url = result?.output_url ?? null;
              if (url) {
                jobOutputUrlRef.current = url;
                if (messagesFinishedRef.current) {
                  onCompleteRef.current(url);
                }
              }
            } else if (data.status === "failed") {
              if (intervalId) clearInterval(intervalId);
              setErrorMsg("Processing failed. Please try again.");
            }
          } catch (err) {
            if (intervalId) clearInterval(intervalId);
            setErrorMsg(err instanceof Error ? err.message : "Lost connection to server.");
          }
        }, 2000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      }
    }

    void startJob();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [selectedClipIndex, config]);

  if (errorMsg) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-red-400">{errorMsg}</p>
        <button
          onClick={onError}
          className="mt-4 text-sm text-[#9146FF] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const progress = (doneIndices.size / MESSAGES.length) * 100;

  return (
    <div className="rounded-xl border-l-4 border-[#9146FF] bg-zinc-900 p-6">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 3 -- Processing
      </p>

      <div className="flex flex-col gap-3">
        {MESSAGES.map((message, index) => {
          const isDone    = doneIndices.has(index);
          const isActive  = activeIndex === index && !isDone;
          const isPending = index > activeIndex;

          return (
            <div
              key={index}
              className={`flex items-center gap-3 transition-opacity duration-300 ${isPending ? "opacity-30" : ""}`}
            >
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                  isDone
                    ? "bg-green-500"
                    : isActive
                    ? "bg-[#9146FF]"
                    : "border-2 border-zinc-700"
                }`}
              >
                {isDone && <span className="text-[10px] font-bold text-white">&#10003;</span>}
                {isActive && (
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isDone
                    ? "text-zinc-500 line-through"
                    : isActive
                    ? "font-semibold text-zinc-100"
                    : "text-zinc-600"
                }`}
              >
                {message}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9146FF] to-[#b07eff] transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/ProcessingWindow.tsx
git commit -m "feat: add ProcessingWindow with timed steps and backend polling"
```

---

## Task 9: RevealPanel component

**Files:**
- Create: `src/app/components/demo/RevealPanel.tsx`

- [ ] **Step 1: Create `src/app/components/demo/RevealPanel.tsx`**

```tsx
"use client";

type RevealPanelProps = {
  outputUrl: string;
  onReset: () => void;
};

export function RevealPanel({ outputUrl, onReset }: RevealPanelProps) {
  // Cache-bust so the browser doesn't serve a stale prior render
  const videoUrl = `${outputUrl}?t=${Date.now()}`;

  return (
    <section className="py-20">
      <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 4 -- Your Highlight
      </p>

      <div className="flex flex-wrap items-center justify-center gap-16">
        {/* Phone frame -- scale-up entrance */}
        <div className="animate-reveal-phone w-36 rounded-3xl border-2 border-[#9146FF] bg-zinc-950 p-1.5 shadow-[0_0_48px_rgba(145,70,255,0.35),0_16px_48px_rgba(0,0,0,0.7)]">
          <div className="flex h-3 items-center justify-center rounded-t-lg bg-zinc-900">
            <div className="h-1 w-5 rounded-full bg-zinc-700" />
          </div>
          <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "9 / 16" }}>
            <video
              src={videoUrl}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-0.5 flex h-2.5 items-center justify-center rounded-b-lg bg-zinc-900">
            <div className="h-1 w-6 rounded-full bg-zinc-700" />
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-xs">
          <h2 className="text-3xl font-black leading-tight text-white">
            Your clip,
            <br />
            <span className="text-[#9146FF]">ready to post</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Captioned, cropped, vertical. Export and post directly to TikTok or Reels.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={videoUrl}
              download
              className="block rounded-lg bg-[#9146FF] py-3 text-center text-sm font-bold text-white shadow-[0_2px_12px_rgba(145,70,255,0.4)] transition-all hover:bg-[#7c3aed] hover:shadow-[0_4px_20px_rgba(145,70,255,0.5)]"
            >
              Download
            </a>
            <button
              onClick={onReset}
              className="rounded-lg bg-zinc-800 py-3 text-sm text-zinc-400 transition-all hover:bg-zinc-700 hover:text-zinc-200"
            >
              Try another clip
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/components/demo/RevealPanel.tsx
git commit -m "feat: add RevealPanel with scale-up entrance and download CTA"
```

---

## Task 10: Landing page orchestrator

**Files:**
- Replace: `src/app/page.tsx` (overwrite the old editor page -- the editor now lives at `/app`)

- [ ] **Step 1: Replace `src/app/page.tsx` with the new landing orchestrator**

```tsx
"use client";

import { useRef, useState } from "react";
import type { DemoConfig, DemoStage } from "./types";
import { DemoHero } from "./components/demo/DemoHero";
import { ClipPicker } from "./components/demo/ClipPicker";
import { StyleConfigurator } from "./components/demo/StyleConfigurator";
import { ProcessingWindow } from "./components/demo/ProcessingWindow";
import { RevealPanel } from "./components/demo/RevealPanel";
import { MiniPhonePreview } from "./components/demo/MiniPhonePreview";

const DEFAULT_CONFIG: DemoConfig = {
  font: "Montserrat",
  color: "#FFFFFF",
  layout: "cropped",
};

export default function Home() {
  const [stage, setStage]                       = useState<DemoStage>("pick");
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [config, setConfig]                     = useState<DemoConfig>(DEFAULT_CONFIG);
  const [outputUrl, setOutputUrl]               = useState<string | null>(null);

  const configureRef  = useRef<HTMLDivElement>(null);
  const processingRef = useRef<HTMLDivElement>(null);
  const revealRef     = useRef<HTMLDivElement>(null);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function handleClipSelect(index: number) {
    setSelectedClipIndex(index);
    if (stage === "pick") {
      setStage("configure");
      scrollTo(configureRef);
    }
  }

  function handleGenerate() {
    setStage("processing");
    scrollTo(processingRef);
  }

  function handleProcessingComplete(url: string) {
    setOutputUrl(url);
    setStage("reveal");
    scrollTo(revealRef);
  }

  function handleReset() {
    setStage("pick");
    setSelectedClipIndex(null);
    setConfig(DEFAULT_CONFIG);
    setOutputUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showSteps       = stage !== "pick";
  const showMiniPreview = stage === "configure" || stage === "processing";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <DemoHero />

      <ClipPicker
        selectedClipIndex={selectedClipIndex}
        onSelect={handleClipSelect}
      />

      {showSteps && (
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <div
            className={`grid gap-8 ${showMiniPreview ? "grid-cols-[1fr_120px]" : "grid-cols-1"}`}
          >
            {/* Left col: step 2 + step 3 */}
            <div className="space-y-6">
              <div ref={configureRef}>
                <StyleConfigurator
                  config={config}
                  onConfigChange={setConfig}
                  selectedClipIndex={selectedClipIndex}
                  onGenerate={handleGenerate}
                />
              </div>

              {(stage === "processing") && selectedClipIndex !== null && (
                <div ref={processingRef}>
                  <ProcessingWindow
                    selectedClipIndex={selectedClipIndex}
                    config={config}
                    onComplete={handleProcessingComplete}
                    onError={() => setStage("configure")}
                  />
                </div>
              )}
            </div>

            {/* Right col: mini preview (hidden at reveal) */}
            {showMiniPreview && (
              <MiniPhonePreview
                config={config}
                selectedClipIndex={selectedClipIndex}
              />
            )}
          </div>

          {/* Step 4: full width reveal */}
          {stage === "reveal" && outputUrl && (
            <div ref={revealRef}>
              <RevealPanel outputUrl={outputUrl} onReset={handleReset} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check and build**

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Smoke test in dev server**

Start the Next.js dev server and visually verify:

```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run dev
```

Open `http://localhost:3000` and confirm:
- Nav shows "Demo / App / FAQ", Demo is highlighted
- Hero headline renders with purple "into viral shorts"
- Three clip cards show (placeholder gradients since videoSrc is empty)
- Hovering a card: scales up, purple glow, audio bars animate
- Clicking a clip: card gets checkmark, page auto-scrolls to Step 2
- Changing font/colour/layout: MiniPhonePreview caption bar updates live
- `http://localhost:3000/app` shows the existing full editor
- `http://localhost:3000/faq` shows the FAQ stub

Generating Highlight requires the backend running -- skip that step for now.

- [ ] **Step 4: Commit**

```bash
cd /home/jirod/repos/twitchtok-showcase
git add frontend/src/app/page.tsx
git commit -m "feat: add landing page orchestrator -- TwitchTok demo flow"
```

---

## Task 11: Integration smoke test and push

- [ ] **Step 1: Start both servers and test the full flow**

Terminal 1 -- backend:
```bash
cd /home/jirod/repos/twitchtok-showcase/backend
python -m uvicorn app.main:app --reload --port 8000
```

Terminal 2 -- frontend:
```bash
cd /home/jirod/repos/twitchtok-showcase/frontend
npm run dev
```

Open `http://localhost:3000` and walk through the full demo:
1. Click a clip card -- confirm auto-scroll to Step 2
2. Change a font/colour -- confirm MiniPhonePreview updates
3. Click "Generate Highlight" -- confirm auto-scroll to Step 3, messages tick through
4. After processing completes -- confirm auto-scroll to Step 4, phone frame scales in
5. Click "Download" -- file download triggers
6. Click "Try another clip" -- page resets and scrolls to top

- [ ] **Step 2: Push to origin**

```bash
cd /home/jirod/repos/twitchtok-showcase
git push
```

---

## Post-build: add real clips

When the 3 demo clips are chosen, update two places only:

1. `frontend/src/app/components/demo/demoClips.ts` -- fill in `videoSrc` and `inputPath` for each clip
2. Pre-run the backend on each clip once to cache transcripts and crop data in `backend/storage/`

No other code changes needed.
