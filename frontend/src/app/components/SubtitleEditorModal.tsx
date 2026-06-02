"use client";

import { useEffect, useRef, useState } from "react";
import type { EditableCaptionDraft } from "../types";
import { SubtitleTimeline } from "./SubtitleTimeline";

const SNAP_OPTIONS = [
  { label: "0.05s", value: 0.05 },
  { label: "0.1s",  value: 0.1 },
  { label: "0.25s", value: 0.25 },
  { label: "0.5s",  value: 0.5 },
  { label: "1s",    value: 1.0 },
  { label: "Off",   value: 0 },
];

type SubtitleEditorModalProps = {
  captions: EditableCaptionDraft[];
  isApplying: boolean;
  isOpen: boolean;
  onAddCaption: () => void;
  onApply: () => void;
  onChangeCaption: (index: number, field: "start" | "end" | "final_text", value: number | string) => void;
  onChangeTiming: (index: number, start: number, end: number) => void;
  onChangePlacement: (index: number, field: "track" | "x" | "y" | "align", value: string | number | null) => void;
  onChangeStyle: (index: number, field: "color" | "font_family" | "font_size" | "outline" | "shadow", value: string | number) => void;
  onClose: () => void;
  onDeleteCaption: (id: number) => void;
  onDuplicateCaption?: (template: EditableCaptionDraft) => void;
  onReset: () => void;
  onSave: () => void;
  outputVideoUrl: string | null;
};

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

export function SubtitleEditorModal({
  captions,
  isApplying,
  isOpen,
  onAddCaption,
  onApply,
  onChangeCaption,
  onChangePlacement,
  onChangeTiming,
  onChangeStyle,
  onClose,
  onDeleteCaption,
  onDuplicateCaption,
  onReset,
  onSave,
  outputVideoUrl,
}: SubtitleEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [selectedCaptionId, setSelectedCaptionId] = useState<number | null>(null);
  const [snapInterval, setSnapInterval] = useState(0.1);
  const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
  const [timelineHeight, setTimelineHeight] = useState(150);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const copiedCaptionRef = useRef<EditableCaptionDraft | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentTime(0);
      setVideoDuration(0);
      setSelectedCaptionId(null);
      return;
    }
    // Prevent page from scrolling behind the modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (selectedCaptionId === null) return;
    document.getElementById(`caption-card-${selectedCaptionId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCaptionId]);

  useEffect(() => {
    if (!isOpen || !outputVideoUrl) return;
    let cancelled = false;
    async function extractPeaks() {
      const audioCtx = new AudioContext();
      try {
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
        setAudioPeaks([]);
      } finally {
        void audioCtx.close();
      }
    }
    void extractPeaks();
    return () => { cancelled = true; };
  }, [outputVideoUrl, isOpen]);

  // Copy/paste keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      // Don't intercept when typing in inputs/textareas
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "c" && selectedCaptionId !== null) {
        const cap = captions.find((c) => c.id === selectedCaptionId);
        if (cap) { copiedCaptionRef.current = cap; }
      }
      if (e.key === "v") {
        const copied = copiedCaptionRef.current;
        if (copied && onDuplicateCaption) {
          e.preventDefault();
          onDuplicateCaption(copied);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedCaptionId, captions, onDuplicateCaption]);

  if (!isOpen) return null;

  function handleSeek(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function handleTimelineChange(id: number, start: number, end: number) {
    const index = captions.findIndex((c) => c.id === id);
    if (index === -1) return;
    onChangeTiming(index, start, end);
  }

  function handleTimelineTrackChange(id: number, track: "top" | "bottom") {
    const index = captions.findIndex((c) => c.id === id);
    if (index === -1) return;
    onChangePlacement(index, "track", track);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-2 py-4 backdrop-blur-sm">
      <div className="flex h-[95vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Subtitle Editor</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Ctrl+C copy · Ctrl+V paste · drag blocks between tracks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        {/* Body: 20% preview | 80% segments+timeline */}
        <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: "minmax(240px, 22%) 1fr" }}>

          {/* LEFT: video preview */}
          <div className="flex flex-col border-r border-zinc-800 p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Preview</h3>
            <div className="mt-3 flex flex-1 items-start justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
              {outputVideoUrl ? (
                <div className="relative w-full">
                  <video
                    ref={videoRef}
                    key={outputVideoUrl}
                    controls
                    className="w-full rounded-xl border border-zinc-800"
                    src={outputVideoUrl}
                    onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
                    onLoadedMetadata={() => { if (videoRef.current) setVideoDuration(videoRef.current.duration); }}
                  />
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                    {captions
                      .filter((c) => currentTime >= c.start && currentTime < c.end)
                      .map((c) => {
                        const isTop = c.placement.track === "top";
                        const isBottom = c.placement.track === "bottom";
                        return (
                          <div
                            key={c.id}
                            className="absolute left-0 right-0 px-2 text-center"
                            style={{
                              top: isTop ? "8%" : undefined,
                              bottom: isBottom ? "8%" : undefined,
                              ...(c.placement.track === "free" && c.placement.y != null ? { top: `${c.placement.y}%` } : {}),
                              color: c.style.color,
                              fontFamily: c.style.font_family,
                              fontSize: `${Math.min(c.style.font_size / 5, 32)}px`,
                              fontWeight: 900,
                              lineHeight: 1.2,
                              textShadow: `0 0 ${Math.max(1, c.style.shadow)}px rgba(0,0,0,0.95), 0 0 ${Math.max(1, c.style.outline)}px rgba(0,0,0,0.95)`,
                            }}
                          >
                            {c.final_text}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No preview video.</p>
              )}
            </div>
          </div>

          {/* RIGHT: segments + timeline */}
          <div className="flex min-h-0 flex-col overflow-hidden">

            {/* Segments header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-zinc-200">Subtitle Segments</h3>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                  {captions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onAddCaption}
                disabled={isApplying}
                className="rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Subtitle
              </button>
            </div>

            {/* Scrollable caption cards */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {captions.map((caption, index) => (
                  <div
                    key={`${caption.id}-${index}`}
                    id={`caption-card-${caption.id}`}
                    className={`rounded-2xl border bg-zinc-900 p-4 transition cursor-pointer ${
                      caption.id === selectedCaptionId
                        ? "border-violet-500/60 ring-1 ring-violet-500/30"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                    onClick={() => setSelectedCaptionId(caption.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5">#{index + 1}</span>
                        <span className={`rounded-full border px-2 py-0.5 ${
                          caption.placement.track === "top"
                            ? "border-violet-700/50 text-violet-400"
                            : "border-amber-700/50 text-amber-400"
                        }`}>
                          {caption.placement.track}
                        </span>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                          {formatSeconds(caption.start)}s → {formatSeconds(caption.end)}s
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {onDuplicateCaption && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDuplicateCaption(caption); }}
                            disabled={isApplying}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Copy
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDeleteCaption(caption.id); }}
                          disabled={isApplying}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[100px_100px_minmax(0,1fr)]">
                      <label className="block" onClick={(e) => e.stopPropagation()}>
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Start</span>
                        <input
                          type="number" step="0.01" value={caption.start}
                          onChange={(e) => onChangeCaption(index, "start", Number(e.target.value))}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                        />
                      </label>
                      <label className="block" onClick={(e) => e.stopPropagation()}>
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">End</span>
                        <input
                          type="number" step="0.01" value={caption.end}
                          onChange={(e) => onChangeCaption(index, "end", Number(e.target.value))}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                        />
                      </label>
                      <label className="block" onClick={(e) => e.stopPropagation()}>
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Text</span>
                        <textarea
                          rows={2}
                          value={caption.final_text}
                          onChange={(e) => onChangeCaption(index, "final_text", e.target.value)}
                          className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none focus:border-violet-500"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-4" onClick={(e) => e.stopPropagation()}>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Track</span>
                        <select
                          value={caption.placement.track}
                          onChange={(e) => onChangePlacement(index, "track", e.target.value)}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                        >
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="free">Free</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Color</span>
                        <input
                          type="color" value={caption.style.color}
                          onChange={(e) => onChangeStyle(index, "color", e.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Font</span>
                        <input
                          type="text" value={caption.style.font_family}
                          onChange={(e) => onChangeStyle(index, "font_family", e.target.value)}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Size</span>
                        <input
                          type="number" min={16} step={1} value={caption.style.font_size}
                          onChange={(e) => onChangeStyle(index, "font_size", Number(e.target.value))}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                        />
                      </label>
                    </div>

                    {caption.raw_text && (
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-600">Original</p>
                        <p className="mt-1 break-words text-xs leading-5 text-zinc-500">{caption.refined_text || caption.raw_text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline toolbar */}
            <div className="flex-shrink-0 border-t border-zinc-800">
              <div
                className="flex cursor-ns-resize items-center justify-center border-b border-zinc-800 bg-zinc-900/60 py-0.5 select-none"
                onPointerDown={(e) => {
                  resizeDragRef.current = { startY: e.clientY, startHeight: timelineHeight };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!resizeDragRef.current) return;
                  const delta = resizeDragRef.current.startY - e.clientY;
                  setTimelineHeight(Math.max(100, Math.min(320, resizeDragRef.current.startHeight + delta)));
                }}
                onPointerUp={() => { resizeDragRef.current = null; }}
                onPointerCancel={() => { resizeDragRef.current = null; }}
              >
                <div className="h-1 w-8 rounded-full bg-zinc-700" />
              </div>
              <div className="flex items-center justify-between bg-zinc-900/40 px-4 py-2">
                <span className="text-xs font-medium text-zinc-400">Timeline</span>
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-xs text-zinc-600">Snap:</span>
                  {SNAP_OPTIONS.map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSnapInterval(value)}
                      className={`rounded px-2 py-0.5 text-xs transition ${
                        snapInterval === value
                          ? "border border-violet-500/50 bg-violet-500/20 text-violet-200"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
                onChangeTrack={handleTimelineTrackChange}
                onSeek={handleSeek}
                onSelect={setSelectedCaptionId}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 flex-col gap-3 border-t border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Save keeps your draft. Apply re-renders the video with current captions.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onReset} disabled={isApplying}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50">
              Reset
            </button>
            <button type="button" onClick={onClose} disabled={isApplying}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={onSave} disabled={isApplying}
              className="rounded-xl border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/30 disabled:opacity-50">
              Save Draft
            </button>
            <button type="button" onClick={onApply} disabled={isApplying || captions.length === 0}
              className="rounded-xl border border-green-500/40 bg-green-500/20 px-4 py-2 text-sm font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/30 disabled:opacity-50">
              {isApplying ? "Applying..." : "Apply & Re-render"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
