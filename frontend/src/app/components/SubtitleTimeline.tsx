"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditableCaptionDraft } from "../types";

const MIN_CAPTION_DURATION = 0.1;

type DragState = {
  mode: "move" | "resize-start" | "resize-end" | "seek";
  captionId: number | null;
  startClientX: number;
  originalStart: number;
  originalEnd: number;
};

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

function snapTo(t: number, interval: number): number {
  if (interval <= 0) return t;
  return Math.round(t / interval) * interval;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatRulerTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollPx, setScrollPx] = useState(0);

  const stateRef = useRef({ captions, duration, snapInterval, onChange, onSeek, zoom, scrollPx });
  stateRef.current = { captions, duration, snapInterval, onChange, onSeek, zoom, scrollPx };

  const clientXToTime = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const relPx = clientX - rect.left;
    const { duration: d, zoom: z, scrollPx: sp } = stateRef.current;
    const tw = el.clientWidth * z;
    return clamp(((relPx + sp) / tw) * d, 0, d);
  }, []); // stateRef always has current values, no deps needed

  useEffect(() => {
    if (disabled) return;

    function handlePointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const { duration: dur, snapInterval: snap, onSeek: seekFn, onChange: changeFn, zoom: z } = stateRef.current;
      if (dur <= 0) return;

      const el = containerRef.current;
      if (!el) return;
      const tWidth = el.clientWidth * z;
      const dt = ((e.clientX - drag.startClientX) / tWidth) * dur;

      if (drag.mode === "seek") {
        seekFn(clamp(snapTo(clientXToTime(e.clientX), snap), 0, dur));
        return;
      }

      const id = drag.captionId;
      if (id === null) return;

      if (drag.mode === "move") {
        const len = drag.originalEnd - drag.originalStart;
        const newStart = clamp(snapTo(drag.originalStart + dt, snap), 0, dur - len);
        changeFn(id, newStart, newStart + len);
      } else if (drag.mode === "resize-start") {
        const newStart = clamp(
          snapTo(drag.originalStart + dt, snap),
          0,
          drag.originalEnd - MIN_CAPTION_DURATION
        );
        changeFn(id, newStart, drag.originalEnd);
      } else if (drag.mode === "resize-end") {
        const newEnd = clamp(
          snapTo(drag.originalEnd + dt, snap),
          drag.originalStart + MIN_CAPTION_DURATION,
          dur
        );
        changeFn(id, drag.originalStart, newEnd);
      }
    }

    function handlePointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [disabled, clientXToTime]);

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

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setZoom((z) => Math.max(1, Math.min(10, z + delta)));
    } else {
      const panDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY * 0.5;
      setScrollPx((sp) => {
        const el = containerRef.current;
        const maxScroll = el ? Math.max(0, el.clientWidth * (zoom - 1)) : 0;
        return Math.max(0, Math.min(maxScroll, sp + panDelta));
      });
    }
  }

  function startSeekDrag(clientX: number) {
    if (disabled || duration <= 0) return;
    const t = clamp(snapTo(clientXToTime(clientX), stateRef.current.snapInterval), 0, duration);
    onSeek(t);
    dragRef.current = {
      mode: "seek",
      captionId: null,
      startClientX: clientX,
      originalStart: 0,
      originalEnd: 0,
    };
  }

  function startBlockDrag(
    e: React.PointerEvent,
    caption: EditableCaptionDraft,
    mode: "move" | "resize-start" | "resize-end"
  ) {
    e.stopPropagation();
    if (disabled) return;
    onSelect(caption.id);
    dragRef.current = {
      mode,
      captionId: caption.id,
      startClientX: e.clientX,
      originalStart: caption.start,
      originalEnd: caption.end,
    };
  }

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

  const tickStep =
    duration <= 15 ? 1 : duration <= 60 ? 5 : duration <= 180 ? 10 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= Math.ceil(duration); t += tickStep) {
    if (t <= duration) ticks.push(t);
  }

  const topCaptions = captions.filter((c) => c.placement.track !== "bottom");
  const bottomCaptions = captions.filter((c) => c.placement.track === "bottom");

  if (duration <= 0) {
    return (
      <div className="flex items-center justify-center bg-zinc-950 text-xs text-zinc-600" style={{ height }}>
        Load a video to enable the timeline.
      </div>
    );
  }

  const trackH = Math.max(24, Math.floor((height - 24) / 2));

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
          onClick={() => {
            setZoom((z) => {
              const next = Math.max(1, z - 0.5);
              if (next === 1) setScrollPx(0);
              return next;
            });
          }}
        >−</button>
        <span className="text-[10px] text-zinc-600 font-mono">{zoom.toFixed(1)}×</span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800"
          onClick={() => setZoom((z) => Math.min(10, z + 0.5))}
        >+</button>
      </div>

      {/* Ruler */}
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
}
