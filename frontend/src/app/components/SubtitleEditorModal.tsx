"use client";

import type { EditableCaptionDraft } from "../types";

type SubtitleEditorModalProps = {
  captions: EditableCaptionDraft[];
  isOpen: boolean;
  onChangeCaption: (
    index: number,
    field: "start" | "end" | "final_text",
    value: number | string
  ) => void;
  onClose: () => void;
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
  isOpen,
  onChangeCaption,
  onClose,
  onReset,
  onSave,
  outputVideoUrl,
}: SubtitleEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Subtitle Editor
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Edit subtitle text and timings. This stage is frontend-only for now.
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
              Video reference for timing and wording checks.
            </p>

            <div className="mt-4 flex min-h-[420px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
              {outputVideoUrl ? (
                <video
                  key={outputVideoUrl}
                  controls
                  className="max-h-[620px] rounded-2xl border border-zinc-800"
                  src={outputVideoUrl}
                />
              ) : (
                <div className="text-sm text-zinc-500">
                  No preview video available.
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Subtitle Segments
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Update text and exact timing values. Timeline dragging comes in a later step.
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
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="rounded-full border border-zinc-700 px-2 py-1">
                      #{index + 1}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1">
                      {caption.status || "draft"}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1">
                      {formatSeconds(caption.start)}s → {formatSeconds(caption.end)}s
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[120px_120px_minmax(0,1fr)]">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Start
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={caption.start}
                        onChange={(event) =>
                          onChangeCaption(
                            index,
                            "start",
                            Number(event.target.value)
                          )
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        End
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={caption.end}
                        onChange={(event) =>
                          onChangeCaption(
                            index,
                            "end",
                            Number(event.target.value)
                          )
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                      />
                    </label>

                    <label className="block">
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

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Original Draft Reference
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {caption.refined_text || caption.raw_text || "No original text available."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Save will only update the frontend draft state in this step.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Reset Changes
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              className="rounded-2xl border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/30"
            >
              Save Subtitle Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}