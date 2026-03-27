"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import type { DragMode, DragTarget, StackedConfig } from "../types";

type CropEditorModalProps = {
  bottomPreviewStyle: React.CSSProperties;
  cropDraft: StackedConfig;
  cropEditorPreviewUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLoadedData: (video: HTMLVideoElement) => void;
  onLoadedMetadata: (video: HTMLVideoElement) => void;
  onSave: () => void;
  onStartDrag: (
    event: ReactPointerEvent,
    target: DragTarget,
    mode: DragMode
  ) => void;
  onUpdateSplitRatio: (value: number) => void;
  previewContainerRef: RefObject<HTMLDivElement | null>;
  topPreviewStyle: React.CSSProperties;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function CropEditorModal({
  bottomPreviewStyle,
  cropDraft,
  cropEditorPreviewUrl,
  isOpen,
  onClose,
  onLoadedData,
  onLoadedMetadata,
  onSave,
  onStartDrag,
  onUpdateSplitRatio,
  previewContainerRef,
  topPreviewStyle,
  videoRef,
}: CropEditorModalProps) {
  if (!isOpen || !cropEditorPreviewUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Visual Stacked Crop Editor
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Drag the colored crop boxes over the source video. Final export
              remains fixed at 1080×1920.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Save crop
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div
              ref={previewContainerRef}
              className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-700 bg-black"
            >
              <video
                ref={videoRef}
                src={cropEditorPreviewUrl}
                controls
                autoPlay
                loop
                muted
                className="block h-auto w-full"
                onLoadedMetadata={(event) => onLoadedMetadata(event.currentTarget)}
                onLoadedData={(event) => onLoadedData(event.currentTarget)}
              />

              <div className="pointer-events-none absolute inset-0">
                <div
                  className="pointer-events-auto absolute border-2 border-violet-400 bg-violet-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]"
                  style={topPreviewStyle}
                  onPointerDown={(event) => onStartDrag(event, "top_crop", "move")}
                >
                  <div className="absolute left-2 top-2 rounded-md bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Top / facecam
                  </div>
                  <div
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl-md bg-violet-400"
                    onPointerDown={(event) =>
                      onStartDrag(event, "top_crop", "resize")
                    }
                  />
                </div>

                <div
                  className="pointer-events-auto absolute border-2 border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.08)]"
                  style={bottomPreviewStyle}
                  onPointerDown={(event) =>
                    onStartDrag(event, "bottom_crop", "move")
                  }
                >
                  <div className="absolute left-2 top-2 rounded-md bg-cyan-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Bottom / gameplay
                  </div>
                  <div
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl-md bg-cyan-400"
                    onPointerDown={(event) =>
                      onStartDrag(event, "bottom_crop", "resize")
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 overflow-auto">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Stack split</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Controls the fixed 1080×1920 output split between the top and
                bottom stacked regions.
              </p>

              <div className="mt-4">
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={1}
                  value={Math.round(cropDraft.split_ratio_top * 100)}
                  onChange={(event) =>
                    onUpdateSplitRatio(Number(event.target.value) / 100)
                  }
                  className="w-full"
                />
                <div className="mt-2 flex items-center justify-between text-sm text-zinc-300">
                  <span>Top: {Math.round(cropDraft.split_ratio_top * 100)}%</span>
                  <span>
                    Bottom: {100 - Math.round(cropDraft.split_ratio_top * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Top crop</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    x
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.top_crop.x}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    y
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.top_crop.y}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    w
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.top_crop.w}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    h
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.top_crop.h}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Bottom crop</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    x
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.x}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    y
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.y}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    w
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.w}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    h
                  </p>
                  <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.h}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-6 text-zinc-400">
              Purple crop fills the top stacked region.
              <br />
              Cyan crop fills the bottom stacked region.
              <br />
              Each crop is scaled to fit its destination while preserving aspect
              ratio.
              <br />
              No stretching is applied.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
