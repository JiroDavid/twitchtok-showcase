"use client";

import type {
  HighlightConfig,
  SourceMode,
  StackedConfig,
  TwitchClip,
  TwitchUser,
} from "../types";

type EditorControlsPanelProps = {
  clipUrl: string;
  currentHighlightConfig: HighlightConfig;
  isSubmitting: boolean;
  layout: HighlightConfig["layout"];
  selectedDownloadedPath: string;
  selectedTwitchClip: TwitchClip | null;
  sourceMode: SourceMode;
  stackedConfig: StackedConfig;
  stackedConfigIsValid: boolean;
  submitButtonLabel: string;
  twitchUser: TwitchUser | null;
  onClipUrlChange: (value: string) => void;
  onOpenConfigureHighlight: () => void;
  onOpenCropEditor: () => void;
  onSourceModeChange: (value: SourceMode) => void;
};

export function EditorControlsPanel({
  clipUrl,
  currentHighlightConfig,
  isSubmitting,
  layout,
  selectedDownloadedPath,
  selectedTwitchClip,
  sourceMode,
  stackedConfig,
  stackedConfigIsValid,
  submitButtonLabel,
  twitchUser,
  onClipUrlChange,
  onOpenConfigureHighlight,
  onOpenCropEditor,
  onSourceModeChange,
}: EditorControlsPanelProps) {
  const canStart =
    !(sourceMode === "twitch_clips" && !selectedTwitchClip) &&
    !(sourceMode === "downloaded_file" && !selectedDownloadedPath) &&
    !(layout === "stacked" && !stackedConfigIsValid);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-xl font-semibold">Editor Controls</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Choose a source, then open the quick highlight setup before starting the pipeline.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onSourceModeChange("twitch_clips")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            sourceMode === "twitch_clips"
              ? "bg-violet-500 text-white"
              : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Twitch Clips
        </button>

        <button
          type="button"
          onClick={() => onSourceModeChange("twitch_url")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            sourceMode === "twitch_url"
              ? "bg-violet-500 text-white"
              : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Twitch Clip URL
        </button>

        <button
          type="button"
          onClick={() => onSourceModeChange("downloaded_file")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            sourceMode === "downloaded_file"
              ? "bg-violet-500 text-white"
              : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Downloaded File
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {sourceMode === "twitch_clips" ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Selected Clip
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Process a clip directly from your authenticated Twitch list.
                </p>
              </div>

              {selectedTwitchClip ? (
                <span className="rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Ready
                </span>
              ) : null}
            </div>

            {!twitchUser ? (
              <p className="mt-4 text-sm text-zinc-500">
                Log in with Twitch to use this source mode.
              </p>
            ) : !selectedTwitchClip ? (
              <p className="mt-4 text-sm text-zinc-500">
                Choose one from the clips grid to continue.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedTwitchClip.thumbnail_url ? (
                  <img
                    src={selectedTwitchClip.thumbnail_url}
                    alt={selectedTwitchClip.title ?? "Selected Twitch clip"}
                    className="h-36 w-full rounded-xl border border-zinc-800 object-cover"
                  />
                ) : null}

                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {selectedTwitchClip.title || "Untitled clip"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>
                      Creator: {selectedTwitchClip.creator_name ?? "Unknown"}
                    </span>
                    <span>•</span>
                    <span>Views: {selectedTwitchClip.view_count ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : sourceMode === "twitch_url" ? (
          <div>
            <label
              htmlFor="clipUrl"
              className="mb-2 block text-sm font-medium text-zinc-200"
            >
              Twitch clip URL
            </label>
            <input
              id="clipUrl"
              type="text"
              value={clipUrl}
              onChange={(event) => onClipUrlChange(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
              placeholder="https://clips.twitch.tv/YourClipSlug"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Use this mode for manual testing or direct pasted URLs.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-400">
            Choose a downloaded file from the browser panel on the right.
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Current Quick Highlight Setup
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                These defaults will be applied before the first render.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              Layout:{" "}
              <span className="font-semibold text-zinc-100">
                {currentHighlightConfig.layout}
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              Font:{" "}
              <span
                className="font-semibold text-zinc-100"
                style={{
                  fontFamily: currentHighlightConfig.subtitle_style.font_family,
                }}
              >
                {currentHighlightConfig.subtitle_style.font_family}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              <span>Subtitle Color</span>
              <span
                className="inline-block h-6 w-12 rounded-md border border-zinc-700"
                style={{
                  backgroundColor: currentHighlightConfig.subtitle_style.color,
                }}
              />
            </div>
          </div>
        </div>

        {layout === "stacked" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Visual Stacked Crop Editor
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  For stacked mode, Twitch sources auto-open crop setup after download.
                  Downloaded files can still open the crop editor directly.
                </p>
              </div>

              {sourceMode === "downloaded_file" ? (
                <button
                  type="button"
                  onClick={onOpenCropEditor}
                  disabled={!selectedDownloadedPath}
                  className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open Visual Crop Editor
                </button>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
                  Crop setup will appear automatically after download for this source.
                </div>
              )}

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Top / Bottom split</span>
                  <span className="font-semibold text-zinc-100">
                    {Math.round(stackedConfig.split_ratio_top * 100)}% /{" "}
                    {100 - Math.round(stackedConfig.split_ratio_top * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {layout !== "stacked" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-xs text-zinc-400">
            {sourceMode === "downloaded_file"
              ? "Downloaded files can process immediately after highlight configuration."
              : "After confirmation, the selected Twitch source will download and continue through the pipeline automatically."}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenConfigureHighlight}
          disabled={!canStart || isSubmitting}
          className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitButtonLabel}
        </button>
      </div>
    </section>
  );
}