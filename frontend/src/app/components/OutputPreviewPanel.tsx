"use client";

import { useState } from "react";
import type { RefObject } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

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
  submitting: "Submitting...",
  downloading: "Downloading clip...",
  download_complete: "Download complete",
  analyzing_layout: "Analysing layout with AI...",
  awaiting_crop: "Waiting for crop confirmation",
  processing: "Rendering video...",
  subtitle_rerender: "Applying subtitle edits...",
  completed: "Completed",
  failed: "Failed",
};

const ACTIVE_STAGES = new Set<PipelineStage>([
  "submitting",
  "downloading",
  "download_complete",
  "analyzing_layout",
  "processing",
  "subtitle_rerender",
]);

function stageColor(stage: PipelineStage) {
  if (stage === "completed") return "text-green-400";
  if (stage === "failed") return "text-red-400";
  if (stage === "awaiting_crop") return "text-amber-400";
  if (ACTIVE_STAGES.has(stage)) return "text-blue-400";
  return "text-zinc-400";
}

type OutputPreviewPanelProps = {
  onAddSubtitles: () => void;
  onOpenCropAdjust: () => void;
  onOpenSubtitleEditor: () => void;
  outputVideoUrl: string | null;
  pipelineMessage: string;
  pipelineStage: PipelineStage;
  processJobStatus: JobStatusResponse | null;
  processingDurationMs: number | null;
  sectionRef: RefObject<HTMLDivElement | null>;
  uiMode: UiMode;
};

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatProcessingTime(ms: number | null) {
  if (ms === null) return "–";
  return `${(ms / 1000).toFixed(1)}s`;
}

function getPreferredCaptionText(caption: MetadataJsonCaptionsEntry) {
  return (
    caption.final_text?.trim() ||
    caption.refined_text?.trim() ||
    caption.raw_text?.trim() ||
    ""
  );
}

function formatSeconds(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.00s";
  return `${value.toFixed(2)}s`;
}

export function OutputPreviewPanel({
  onAddSubtitles,
  onOpenCropAdjust,
  onOpenSubtitleEditor,
  outputVideoUrl,
  pipelineMessage,
  pipelineStage,
  processJobStatus,
  processingDurationMs,
  sectionRef,
  uiMode,
}: OutputPreviewPanelProps) {
  const [outputVideoDuration, setOutputVideoDuration] = useState<number | null>(null);

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

  const showAdjustCrop = isCompleted && processResult?.layout === "stacked";
  const showEditSubtitles = isAiMode && captionItems.length > 0;
  const showAddSubtitles = !isAiMode && isCompleted;

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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Output Preview</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Rendered vertical video and results appear here after processing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {showEditSubtitles && (
            <button
              type="button"
              onClick={onOpenSubtitleEditor}
              className="rounded-xl border border-violet-500/50 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/30"
            >
              Edit Subtitles
            </button>
          )}
          {showAddSubtitles && (
            <button
              type="button"
              onClick={onAddSubtitles}
              className="rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
            >
              Add Subtitles
            </button>
          )}
          {showAdjustCrop && (
            <button
              type="button"
              onClick={onOpenCropAdjust}
              className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/25"
            >
              Adjust Crop
            </button>
          )}
        </div>
      </div>

      {/* Pipeline status */}
      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {ACTIVE_STAGES.has(pipelineStage) && (
              <svg className="h-4 w-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {pipelineStage === "completed" && (
              <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {pipelineStage === "failed" && (
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {pipelineStage === "awaiting_crop" && (
              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className={`text-sm font-semibold ${stageColor(pipelineStage)}`}>
              {getPipelineStageLabel(pipelineStage)}
            </p>
          </div>
          <p className="text-sm text-zinc-400 sm:text-right">{pipelineMessage}</p>
        </div>
      </div>

      {/* Three-column main area */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto_1fr]">

        {/* Left: AI Content Suggestions */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-100">
                AI Content Suggestions
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Copy, tweak, and post.
              </p>
            </div>
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                metadataGeneration?.status === "generated"
                  ? "bg-green-500/15 text-green-300 ring-1 ring-green-500/30"
                  : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
              }`}
            >
              {metadataGeneration?.status ?? "unavailable"}
            </span>
          </div>

          <div className="mt-5 space-y-6">
            {/* Title ideas — first */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Title ideas
              </p>
              {titleSuggestions.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-zinc-700">
                  {titleSuggestions.map((title, index) => (
                    <div
                      key={`${title}-${index}`}
                      className={`flex items-start gap-3 px-4 py-3.5 ${
                        index < titleSuggestions.length - 1
                          ? "border-b border-zinc-800"
                          : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">
                        {index + 1}
                      </span>
                      <span className="text-base font-semibold leading-6 text-zinc-100">
                        {title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">No title suggestions available.</p>
              )}
            </div>

            {/* Hashtags — second */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Hashtags
                </p>
                {hashtagSuggestions.length > 0 && (
                  <CopyButton text={hashtagSuggestions.map((t) => `#${t}`).join(" ")} />
                )}
              </div>
              {hashtagSuggestions.length > 0 ? (
                <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
                  <p className="text-sm leading-7 text-violet-200">
                    {hashtagSuggestions.map((tag) => `#${tag}`).join(" ")}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">No hashtags available.</p>
              )}
            </div>

            {/* Video Description — third */}
            {summary && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Video Description
                </p>
                <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-200">
                  {summary}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Video + metadata stats */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex min-h-[680px] w-full items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
            {outputVideoUrl ? (
              <video
                key={outputVideoUrl}
                controls
                className="max-h-[640px] rounded-2xl border border-zinc-800 shadow-2xl"
                src={outputVideoUrl}
                onLoadedMetadata={(event) =>
                  setOutputVideoDuration(event.currentTarget.duration)
                }
              />
            ) : (
              <div className="text-center text-sm text-zinc-500">
                No processed video yet. Start a job to preview the result.
              </div>
            )}
          </div>

          {processResult && (
            <div className="grid w-full grid-cols-5 gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Duration</p>
                <p className="mt-1.5 text-sm font-semibold text-zinc-100">
                  {formatDuration(outputVideoDuration)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Subtitles</p>
                <p className="mt-1.5 text-sm font-semibold text-zinc-100">
                  {captionItems.length > 0 ? captionItems.length : "None"}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Layout</p>
                <p className="mt-1.5 text-sm font-semibold text-zinc-100">
                  {getLayoutLabel(processResult.layout)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Mode</p>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isAiMode
                      ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                      : "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700"
                  }`}
                >
                  {isAiMode ? "AI" : "Manual"}
                </span>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Render time</p>
                <p className="mt-1.5 text-sm font-semibold text-zinc-100">
                  {formatProcessingTime(processingDurationMs)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Captions */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-lg font-bold text-zinc-100">Captions</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {isAiMode
              ? "Auto-generated subtitle segments."
              : "Manually added subtitle segments."}
          </p>

          {captionItems.length > 0 ? (
            <div className="mt-5 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {captionItems.map((caption, index) => {
                const preferredText = getPreferredCaptionText(caption);
                return (
                  <div
                    key={`${caption.id ?? index}-${caption.start ?? index}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-400">#{index + 1}</span>
                      <span>
                        {formatSeconds(caption.start)} → {formatSeconds(caption.end)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">
                      {preferredText || "No caption text."}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-500">
              {isAiMode
                ? "No captions generated yet."
                : "No subtitles added yet."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
