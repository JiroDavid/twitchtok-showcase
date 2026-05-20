"use client";

import { useCallback, useEffect, useRef } from "react";
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
  captions: EditableCaptionDraft[];
  currentTime: number;
  disabled?: boolean;
  duration: number;
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
  captions,
  currentTime,
  disabled = false,
  duration,
  selectedId,
  snapInterval,
  onChange,
  onSeek,
  onSelect,
}: SubtitleTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const stateRef = useRef({ captions, duration, snapInterval, onChange, onSeek });
  stateRef.current = { captions, duration, snapInterval, onChange, onSeek };

  const clientXToTime = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * stateRef.current.duration;
  }, []);

  useEffect(() => {
    if (disabled) return;

    function handlePointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const { duration, snapInterval, onSeek, onChange } = stateRef.current;
      if (duration <= 0) return;

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dt = ((e.clientX - drag.startClientX) / rect.width) * duration;

      if (drag.mode === "seek") {
        onSeek(clamp(snapTo(clientXToTime(e.clientX), snapInterval), 0, duration));
        return;
      }

      const id = drag.captionId;
      if (id === null) return;

      if (drag.mode === "move") {
        const len = drag.originalEnd - drag.originalStart;
        const newStart = clamp(snapTo(drag.originalStart + dt, snapInterval), 0, duration - len);
        onChange(id, newStart, newStart + len);
      } else if (drag.mode === "resize-start") {
        const newStart = clamp(
          snapTo(drag.originalStart + dt, snapInterval),
          0,
          drag.originalEnd - MIN_CAPTION_DURATION
        );
        onChange(id, newStart, drag.originalEnd);
      } else if (drag.mode === "resize-end") {
        const newEnd = clamp(
          snapTo(drag.originalEnd + dt, snapInterval),
          drag.originalStart + MIN_CAPTION_DURATION,
          duration
        );
        onChange(id, drag.originalStart, newEnd);
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

  function pct(t: number): string {
    return `${duration > 0 ? clamp((t / duration) * 100, 0, 100) : 0}%`;
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

    const widthPct =
      duration > 0
        ? clamp(((caption.end - caption.start) / duration) * 100, 0, 100)
        : 0;

    if (widthPct < 0.05) return null;

    const tooltip = `${caption.final_text || "(empty)"}\n${caption.start.toFixed(2)}s – ${caption.end.toFixed(2)}s`;

    return (
      <div
        key={caption.id}
        title={tooltip}
        className={`absolute top-1.5 bottom-1.5 rounded-md border-2 overflow-hidden shadow shadow-black/50 ${blockCls} ${
          disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ left: pct(caption.start), width: `${widthPct}%`, minWidth: 6 }}
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
  const playheadPos = pct(currentTime);

  if (duration <= 0) {
    return (
      <div className="flex h-28 items-center justify-center bg-zinc-950 text-xs text-zinc-600">
        Load a video to enable the timeline.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none overflow-hidden bg-zinc-950 ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <div
        className="relative h-6 border-b border-zinc-800 bg-zinc-900/60 cursor-crosshair"
        onPointerDown={(e) => startSeekDrag(e.clientX)}
      >
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center pointer-events-none"
            style={{ left: pct(t), transform: "translateX(-50%)" }}
          >
            <div className="h-2 w-px bg-zinc-600" />
            <span className="text-[9px] text-zinc-500 leading-none mt-px">
              {formatRulerTime(t)}
            </span>
          </div>
        ))}
        <div
          className="absolute top-0 z-20 pointer-events-none"
          style={{ left: playheadPos, transform: "translateX(-50%)" }}
        >
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-500" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10"
          style={{ left: playheadPos }}
        />
      </div>

      <div
        className="relative border-b border-zinc-800/60 cursor-crosshair"
        style={{ height: 48 }}
        onPointerDown={(e) => startSeekDrag(e.clientX)}
      >
        <span className="absolute left-1.5 top-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-700 pointer-events-none z-10">
          Top / Free
        </span>
        {topCaptions.map(renderBlock)}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/60 pointer-events-none z-10"
          style={{ left: playheadPos }}
        />
      </div>

      <div
        className="relative cursor-crosshair"
        style={{ height: 48 }}
        onPointerDown={(e) => startSeekDrag(e.clientX)}
      >
        <span className="absolute left-1.5 top-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-700 pointer-events-none z-10">
          Bottom
        </span>
        {bottomCaptions.map(renderBlock)}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/60 pointer-events-none z-10"
          style={{ left: playheadPos }}
        />
      </div>
    </div>
  );
}
