"use client";

import type { DownloadedClip, LayoutOption } from "../types";

type DownloadedFilesPanelProps = {
  downloadedClips: DownloadedClip[];
  getDownloadedClipUrl: (clip: DownloadedClip) => string;
  layout: LayoutOption;
  selectedDownloadedClip: DownloadedClip | null;
  selectedDownloadedPath: string;
  onOpenCropEditor: () => void;
  onOpenDownloadedClip: (clip: DownloadedClip) => void;
  onSelectDownloadedClip: (clip: DownloadedClip) => void;
};

export function DownloadedFilesPanel({
  downloadedClips,
  getDownloadedClipUrl,
  layout,
  selectedDownloadedClip,
  selectedDownloadedPath,
  onOpenCropEditor,
  onOpenDownloadedClip,
  onSelectDownloadedClip,
}: DownloadedFilesPanelProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Downloaded Files</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Browse already-downloaded local test files, select one, and process it
            without redownloading.
          </p>
        </div>

        {selectedDownloadedClip ? (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            Active file:{" "}
            <span className="font-semibold">{selectedDownloadedClip.filename}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-6">
        {selectedDownloadedClip ? (
          <div className="rounded-2xl border border-violet-500 bg-zinc-950 p-4 ring-1 ring-violet-500">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Selected Downloaded File
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  This file will be used as the current source.
                </p>
              </div>

              <span className="rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                Selected
              </span>
            </div>

            <video
              src={getDownloadedClipUrl(selectedDownloadedClip)}
              controls
              className="h-64 w-full rounded-xl border border-zinc-800 bg-black object-cover xl:h-72"
            />

            <p className="mt-4 break-all text-sm text-zinc-200">
              {selectedDownloadedClip.filename}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
              <button
                type="button"
                onClick={onOpenCropEditor}
                disabled={layout !== "stacked"}
                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Crop Editor
              </button>

              <button
                type="button"
                onClick={() => onOpenDownloadedClip(selectedDownloadedClip)}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Open
              </button>
            </div>
          </div>
        ) : null}

        {downloadedClips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-500">
            No downloaded files found yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {downloadedClips.map((clip) => {
              const isSelected = selectedDownloadedPath === clip.download_path;

              return (
                <div
                  key={clip.download_path}
                  className={`overflow-hidden rounded-2xl border bg-zinc-950 transition ${
                    isSelected
                      ? "border-violet-500 ring-1 ring-violet-500"
                      : "border-zinc-800"
                  }`}
                >
                  <video
                    src={getDownloadedClipUrl(clip)}
                    muted
                    controls
                    className="h-44 w-full bg-black object-cover"
                  />

                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">
                        {clip.filename}
                      </h3>
                      {isSelected ? (
                        <span className="rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>

                    <p className="break-all text-xs text-zinc-500">
                      {clip.download_path}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectDownloadedClip(clip)}
                        className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400"
                      >
                        Select
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenDownloadedClip(clip)}
                        className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
