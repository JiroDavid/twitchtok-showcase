"use client";

import type { RefObject } from "react";

import type {
  JobStatusResponse,
  LayoutOption,
  MetadataJsonCaptionsEntry,
  MetadataJsonPayload,
  PipelineStage,
  ProcessJobResult,
  UiMode,
} from "../types";

const LAYOUT_LABELS: Record<LayoutOption, string> = {
  cropped: "Cropped",
  fullscreen: "Fullscreen",
  stacked: "Stacked",
};

const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  idle: "Ready",
  submitting: "Submitting",
  downloading: "Downloading",
  download_complete: "Download Complete",
  analyzing_layout: "Analysing Layout",
  awaiting_crop: "Awaiting Crop Confirmation",
  processing: "Processing",
  subtitle_rerender: "Applying Subtitle Edits",
  completed: "Completed",
  failed: "Failed",
};

type OutputPreviewPanelProps = {
  onAddSubtitles: () => void;
  onOpenCropAdjust: () => void;
  onOpenSubtitleEditor: () => void;
  outputVideoUrl: string | null;
  pipelineMessage: string;
  pipelineStage: PipelineStage;
  processJobStatus: JobStatusResponse | null;
  sectionRef: RefObject<HTMLDivElement | null>;
  statusTone: string;
  uiMode: UiMode;
};

function formatSeconds(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.00s";
  return `${value.toFixed(2)}s`;
}

function getPreferredCaptionText(caption: MetadataJsonCaptionsEntry) {
  const finalText = caption.final_text?.trim();
  const refinedText = caption.refined_text?.trim();
  const rawText = caption.raw_text?.trim();

  return finalText || refinedText || rawText || "";
}

export function OutputPreviewPanel({
  onAddSubtitles,
  onOpenCropAdjust,
  onOpenSubtitleEditor,
  outputVideoUrl,
  pipelineMessage,
  pipelineStage,
  processJobStatus,
  sectionRef,
  statusTone,
  uiMode,
}: OutputPreviewPanelProps) {
  const isCompleted = pipelineStage === "completed";
  const isAiMode = uiMode === "ai";
  const processResult = processJobStatus?.result as ProcessJobResult | null;
  const metadataPayload = processResult?.metadata?.payload as
    | MetadataJsonPayload
    | undefined;

  const metadataGeneration = metadataPayload?.metadata_generation;
  const titleSuggestions = metadataGeneration?.title_suggestions ?? [];
  const hashtagSuggestions = metadataGeneration?.hashtag_suggestions ?? [];
  const summary = metadataGeneration?.summary ?? null;
  const captionItems = metadataPayload?.captions?.items ?? [];

  function getLayoutLabel(value: string | undefined) {
    if (!value) return "N/A";
    return LAYOUT_LABELS[value as LayoutOption] ?? value;
  }

  function getPipelineStageLabel(value: PipelineStage) {
    return PIPELINE_STAGE_LABELS[value] ?? value;
  }

  return (
    <div
      ref={sectionRef}
      className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Output Preview</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Once processing completes, the rendered vertical video appears here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {processResult ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
              {getLayoutLabel(processResult.layout)} layout
            </div>
          ) : null}

          {isCompleted && processResult?.layout === "stacked" ? (
            <button
              type="button"
              onClick={onOpenCropAdjust}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              Adjust Crop
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Pipeline status
            </p>
            <p className={`mt-1 text-sm font-semibold ${statusTone}`}>
              {getPipelineStageLabel(pipelineStage)}
            </p>
          </div>

          <p className="text-sm text-zinc-400 sm:max-w-xl sm:text-right">
            {pipelineMessage}
          </p>
        </div>
      </div>

      <div className="mt-6 flex min-h-[700px] items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
        {outputVideoUrl ? (
          <video
            key={outputVideoUrl}
            controls
            className="max-h-[660px] rounded-2xl border border-zinc-800 shadow-2xl"
            src={outputVideoUrl}
          />
        ) : (
          <div className="text-center text-sm text-zinc-500">
            No processed video yet. Start a job to preview the result.
          </div>
        )}
      </div>

      {processResult && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Filename
            </p>
            <p className="mt-2 break-all">{processResult.filename ?? "N/A"}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Layout
            </p>
            <p className="mt-2">{getLayoutLabel(processResult.layout)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Output URL
            </p>
            <p className="mt-2 break-all">{processResult.output_url ?? "N/A"}</p>
          </div>
        </div>
      )}

      {processResult && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  AI Metadata Suggestions
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Read-only draft recommendations generated from transcript and visual context.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                {metadataGeneration?.status ?? "unavailable"}
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Title Suggestions
                </p>
                {titleSuggestions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {titleSuggestions.map((title, index) => (
                      <div
                        key={`${title}-${index}`}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200"
                      >
                        <span className="mr-2 text-zinc-500">{index + 1}.</span>
                        {title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    No title suggestions available yet.
                  </p>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Hashtag Suggestions
                </p>
                {hashtagSuggestions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hashtagSuggestions.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    No hashtag suggestions available yet.
                  </p>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Summary
                </p>
                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-300">
                  {summary || "No summary available yet."}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Captions
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Auto-generated subtitle segments. Editing comes next.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                  {captionItems.length} segments
                </div>

                {isAiMode && captionItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={onOpenSubtitleEditor}
                    className="rounded-xl border border-violet-500/40 bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/30"
                  >
                    Edit Subtitles
                  </button>
                ) : null}

                {!isAiMode && isCompleted ? (
                  <button
                    type="button"
                    onClick={onAddSubtitles}
                    className="rounded-xl border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
                  >
                    Add Subtitles
                  </button>
                ) : null}
              </div>
            </div>

            {captionItems.length > 0 ? (
              <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {captionItems.map((caption, index) => {
                  const preferredText = getPreferredCaptionText(caption);

                  return (
                    <div
                      key={`${caption.id ?? index}-${caption.start ?? index}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded-full border border-zinc-700 px-2 py-1">
                          #{index + 1}
                        </span>
                        <span className="rounded-full border border-zinc-700 px-2 py-1">
                          {formatSeconds(caption.start)} → {formatSeconds(caption.end)}
                        </span>
                        {caption.status ? (
                          <span className="rounded-full border border-zinc-700 px-2 py-1">
                            {caption.status}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-200">
                        {preferredText || "No caption text available."}
                      </p>

                      <div className="mt-3 text-xs text-zinc-500">
                        Source priority: final → refined → raw
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-500">
                No captions available yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}