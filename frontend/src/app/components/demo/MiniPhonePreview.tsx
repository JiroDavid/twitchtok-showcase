"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoConfig, HighlightFontOption } from "../../types";

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
  const videoSrc = selectedClipIndex !== null
    ? `/clips/clip${selectedClipIndex + 1}_cut.mp4`
    : null;
  const stackedSrc = selectedClipIndex !== null
    ? `/demo_cache/clip${selectedClipIndex + 1}/base_stacked.mp4`
    : null;

  const [isMuted, setIsMuted] = useState(true);
  const [stackedFailed, setStackedFailed] = useState(false);

  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const stackedVideoRef = useRef<HTMLVideoElement>(null);
  const prevClipIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevClipIndexRef.current;
    prevClipIndexRef.current = selectedClipIndex;

    if (selectedClipIndex === null) {
      setIsMuted(true);
    } else if (prev === null) {
      // First selection: auto-unmute (the click is a valid user gesture)
      setIsMuted(false);
    }
    // Switching between clips: keep current muted state, just reset failed flag
    setStackedFailed(false);
  }, [selectedClipIndex]);

  // Mute only the active layout's video — hidden videos stay muted regardless
  useEffect(() => {
    const isStacked = config.layout === "stacked";
    if (mainVideoRef.current) mainVideoRef.current.muted = isMuted || isStacked;
    if (stackedVideoRef.current) stackedVideoRef.current.muted = isMuted || !isStacked;
    // bgVideo is decorative — always muted
  }, [isMuted, config.layout, selectedClipIndex]);

  // Sync bg blur to main video time when switching into cropped
  const prevLayoutRef = useRef(config.layout);
  useEffect(() => {
    if (config.layout === "cropped" && prevLayoutRef.current !== "cropped") {
      if (bgVideoRef.current && mainVideoRef.current) {
        bgVideoRef.current.currentTime = mainVideoRef.current.currentTime;
      }
    }
    prevLayoutRef.current = config.layout;
  }, [config.layout]);

  const isCropped = config.layout === "cropped";
  const isFullscreen = config.layout === "fullscreen";
  const isStacked = config.layout === "stacked";

  return (
    <div className="sticky top-8">
      <p className="mb-3 text-center text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
        Live Preview
      </p>

      <div className="mx-auto w-[420px] rounded-[44px] border-2 border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl shadow-black/60">
        <div className="flex h-6 items-center justify-center rounded-t-xl bg-zinc-800">
          <div className="h-2 w-10 rounded-full bg-zinc-700" />
        </div>

        <div className="relative overflow-hidden rounded-sm bg-black" style={{ aspectRatio: "9 / 16" }}>

          {/* Blurred bg — cropped layout only, always muted, show/hide via opacity */}
          {videoSrc && (
            <video
              ref={bgVideoRef}
              src={videoSrc}
              autoPlay muted loop playsInline
              className="absolute inset-0 h-full w-full object-cover scale-110 pointer-events-none transition-opacity duration-200"
              style={{ filter: "blur(10px)", opacity: isCropped ? 0.75 : 0 }}
            />
          )}

          {/* Main clip video — always playing, opacity-hidden when stacked is active */}
          {videoSrc && (
            <video
              ref={mainVideoRef}
              src={videoSrc}
              autoPlay muted loop playsInline
              className="absolute w-full transition-all duration-200"
              style={
                isStacked
                  ? { opacity: 0, pointerEvents: "none", inset: 0, height: "100%" }
                  : isFullscreen
                  ? { inset: 0, height: "100%", objectFit: "contain" }
                  : /* cropped */ { top: "15%", bottom: "15%", height: "70%", objectFit: "cover" }
              }
            />
          )}

          {/* Stacked — always playing when clip selected, opacity-hidden when not active */}
          {stackedSrc && !stackedFailed && (
            <video
              ref={stackedVideoRef}
              src={stackedSrc}
              autoPlay muted loop playsInline
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
              style={{ opacity: isStacked ? 1 : 0, pointerEvents: isStacked ? "auto" : "none" }}
              onError={() => setStackedFailed(true)}
            />
          )}

          {/* Stacked fallback concept — only rendered when cached video failed */}
          {isStacked && stackedFailed && videoSrc && (
            <StackedFallback src={videoSrc} />
          )}

          {/* Empty state */}
          {!videoSrc && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1c1020] to-zinc-950" />
          )}

          {/* Caption placeholder — updates instantly with font/colour picker */}
          {selectedClipIndex !== null && (
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-8">
              <p
                className="text-center text-[20px] font-extrabold uppercase leading-tight"
                style={{
                  color: config.color,
                  fontFamily: FONT_FAMILY_MAP[config.font as HighlightFontOption],
                  textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 6px rgba(0,0,0,1)",
                }}
              >
                YOUR CAPTION HERE
              </p>
            </div>
          )}

          {/* Mute toggle */}
          {selectedClipIndex !== null && (
            <button
              onClick={() => setIsMuted(m => !m)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.73 1.73L21 18.46 5.54 3 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="mt-0.5 flex h-5 items-center justify-center rounded-b-xl bg-zinc-800">
          <div className="h-2 w-12 rounded-full bg-zinc-700" />
        </div>
      </div>

      <p className="mt-3 text-center text-[9px] text-zinc-600">Updates live</p>
    </div>
  );
}

function StackedFallback({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 overflow-hidden border-b border-zinc-600">
        <video src={src} autoPlay muted loop playsInline
          className="h-full w-full object-cover"
          style={{ objectPosition: "right center", transform: "scale(1.3)", transformOrigin: "right center" }}
        />
        <div className="absolute inset-x-0 top-1 text-center z-10">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[7px] text-white/70">facecam</span>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video src={src} autoPlay muted loop playsInline className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 top-1 text-center z-10">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[7px] text-white/70">gameplay</span>
        </div>
      </div>
    </div>
  );
}
