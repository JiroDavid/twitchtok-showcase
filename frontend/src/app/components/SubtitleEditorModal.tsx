"use client";

import { useEffect, useRef, useState } from "react";
import type { EditableCaptionDraft } from "../types";
import { SubtitleTimeline } from "./SubtitleTimeline";

const SNAP_OPTIONS = [
  { label: "0.05s", value: 0.05 },
  { label: "0.1s", value: 0.1 },
  { label: "0.25s", value: 0.25 },
  { label: "0.5s", value: 0.5 },
  { label: "1s", value: 1.0 },
  { label: "Off", value: 0 },
];

type SubtitleEditorModalProps = {
  captions: EditableCaptionDraft[];
  isApplying: boolean;
  isOpen: boolean;
  onAddCaption: () => void;
  onApply: () => void;
  onChangeCaption: (
    index: number,
    field: "start" | "end" | "final_text",
    value: number | string
  ) => void;
  onChangeTiming: (index: number, start: number, end: number) => void;
  onChangePlacement: (
    index: number,
    field: "track" | "x" | "y" | "align",
    value: string | number | null
  ) => void;
  onChangeStyle: (
    index: number,
    field: "color" | "font_family" | "font_size" | "outline" | "shadow",
    value: string | number
  ) => void;
  onClose: () => void;
  onDeleteCaption: (id: number) => void;
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
  const [timelineHeight, setTimelineHeight] = useState(128);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentTime(0);
      setVideoDuration(0);
      setSelectedCaptionId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCaptionId === null) return;
    document
      .getElementById(`caption-card-${selectedCaptionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCaptionId]);

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
        setAudioPeaks([]);
      }
    }

    void extractPeaks();
    return () => { cancelled = true; };
  }, [outputVideoUrl]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Subtitle Editor
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Edit captions, add missing lines, and control manual subtitle styling for rerenders.
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

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="border-b border-zinc-800 p-5 xl:border-b-0 xl:border-r">
            <h3 className="text-sm font-semibold text-zinc-200">Preview</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Reference preview for timing and subtitle layout decisions.
            </p>

            <div className="mt-4 flex min-h-[420px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
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
            </div>

            <button
              type="button"
              onClick={onAddCaption}
              disabled={isApplying}
              className="mt-4 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add New Subtitle
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Subtitle Segments
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Manual captions can overlap in time. This step focuses on readability and visual control.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                {captions.length} segments
              </div>
            </div>

            <div className="space-y-4">
              {captions.map((caption, index) => (
                <div
                  key={`${caption.id}-${index}`}
                  id={`caption-card-${caption.id}`}
                  className={`rounded-3xl border bg-zinc-900 p-4 transition cursor-pointer ${
                    caption.id === selectedCaptionId
                      ? "border-violet-500/60 ring-1 ring-violet-500/30"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                  onClick={() => setSelectedCaptionId(caption.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        #{index + 1}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        {caption.status || "draft"}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        {caption.is_manual ? "manual" : "detected"}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        {formatSeconds(caption.start)}s → {formatSeconds(caption.end)}s
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCaption(caption.id);
                      }}
                      disabled={isApplying}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[120px_120px_minmax(0,1fr)]">
                    <label className="block" onClick={(e) => e.stopPropagation()}>
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Start
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={caption.start}
                        onChange={(event) =>
                          onChangeCaption(index, "start", Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block" onClick={(e) => e.stopPropagation()}>
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        End
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={caption.end}
                        onChange={(event) =>
                          onChangeCaption(index, "end", Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block" onClick={(e) => e.stopPropagation()}>
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Final Text
                      </span>
                      <textarea
                        rows={3}
                        value={caption.final_text}
                        onChange={(event) =>
                          onChangeCaption(index, "final_text", event.target.value)
                        }
                        className="w-full resize-y rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onClick={(e) => e.stopPropagation()}>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Track
                      </span>
                      <select
                        value={caption.placement.track}
                        onChange={(event) =>
                          onChangePlacement(index, "track", event.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      >
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="free">Free</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Align
                      </span>
                      <select
                        value={caption.placement.align}
                        onChange={(event) =>
                          onChangePlacement(index, "align", event.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      >
                        <option value="top">Top</option>
                        <option value="middle">Middle</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Color
                      </span>
                      <input
                        type="color"
                        value={caption.style.color}
                        onChange={(event) =>
                          onChangeStyle(index, "color", event.target.value)
                        }
                        className="h-11 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-2 py-2"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Font Size
                      </span>
                      <input
                        type="number"
                        min={16}
                        step={1}
                        value={caption.style.font_size}
                        onChange={(event) =>
                          onChangeStyle(index, "font_size", Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onClick={(e) => e.stopPropagation()}>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Outline
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={caption.style.outline}
                        onChange={(event) =>
                          onChangeStyle(index, "outline", Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Shadow
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={caption.style.shadow}
                        onChange={(event) =>
                          onChangeStyle(index, "shadow", Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Font Family
                      </span>
                      <input
                        type="text"
                        value={caption.style.font_family}
                        onChange={(event) =>
                          onChangeStyle(index, "font_family", event.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Style Preview
                      </p>
                      <div className="mt-2 flex min-h-[92px] items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-center">
                        <p
                          className="max-w-full overflow-hidden text-center font-semibold break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                          style={{
                            color: caption.style.color,
                            fontFamily: caption.style.font_family,
                            fontSize: `${Math.min(caption.style.font_size, 40)}px`,
                            lineHeight: 1.15,
                            textShadow: `
                              0 0 ${Math.max(1, caption.style.shadow)}px rgba(0,0,0,0.95),
                              0 0 ${Math.max(1, caption.style.outline)}px rgba(0,0,0,0.95)
                            `,
                          }}
                        >
                          {caption.final_text || "Preview"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Original Draft Reference
                    </p>
                    <p className="mt-2 break-words text-sm leading-6 text-zinc-400 [overflow-wrap:anywhere]">
                      {caption.refined_text || caption.raw_text || "No original text available."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
              setTimelineHeight(Math.max(80, Math.min(320, resizeDragRef.current.startHeight + delta)));
            }}
            onPointerUp={() => { resizeDragRef.current = null; }}
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
            onSeek={handleSeek}
            onSelect={setSelectedCaptionId}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Save keeps your current draft. Apply renders a new subtitle version from the edited caption objects.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onReset}
              disabled={isApplying}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset Changes
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={isApplying}
              className="rounded-2xl border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={onApply}
              disabled={isApplying || captions.length === 0}
              className="rounded-2xl border border-green-500/40 bg-green-500/20 px-4 py-2 text-sm font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? "Applying..." : "Apply Edits & Re-render"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
