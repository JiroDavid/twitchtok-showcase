"use client";

import type {
  JobStatusResponse,
  LayoutOption,
  PipelineStage,
  SourceMode,
} from "../types";

const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  twitch_clips: "Twitch Clips",
  twitch_url: "Twitch Clip URL",
  downloaded_file: "Downloaded File",
};

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

type JobActivityPanelProps = {
  downloadJobId: string | null;
  downloadJobStatus: JobStatusResponse | null;
  layout: LayoutOption;
  overallStatus: PipelineStage;
  pipelineMessage: string;
  pipelineStage: PipelineStage;
  processJobId: string | null;
  processJobStatus: JobStatusResponse | null;
  requestError: string | null;
  sourceMode: SourceMode;
};

export function JobActivityPanel({
  downloadJobId,
  downloadJobStatus,
  layout,
  overallStatus,
  pipelineMessage,
  pipelineStage,
  processJobId,
  processJobStatus,
  requestError,
  sourceMode,
}: JobActivityPanelProps) {
  function getSourceModeLabel(value: SourceMode) {
    return SOURCE_MODE_LABELS[value] ?? value;
  }

  function getLayoutLabel(value: LayoutOption) {
    return LAYOUT_LABELS[value] ?? value;
  }

  function getPipelineStageLabel(value: PipelineStage) {
    return PIPELINE_STAGE_LABELS[value] ?? value;
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Job Activity</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Pipeline status for the current run.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ACTIVE_STAGES.has(overallStatus) && (
            <svg
              className="h-4 w-4 animate-spin text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {overallStatus === "completed" && (
            <svg
              className="h-4 w-4 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {overallStatus === "failed" && (
            <svg
              className="h-4 w-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${stageColor(overallStatus)}`}>
            {getPipelineStageLabel(overallStatus)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Selected source
          </p>
          <p className="mt-1 text-sm text-zinc-100">
            {getSourceModeLabel(sourceMode)}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Layout
          </p>
          <p className="mt-1 text-sm text-zinc-100">{getLayoutLabel(layout)}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Pipeline stage
          </p>
          <p className={`mt-1 text-sm font-semibold ${stageColor(pipelineStage)}`}>
            {getPipelineStageLabel(pipelineStage)}
          </p>
          <p className="mt-2 text-xs text-zinc-400">{pipelineMessage}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Download job
          </p>
          <p className="mt-1 truncate text-sm text-zinc-100">
            {downloadJobId ?? "Not started"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Process job
          </p>
          <p className="mt-1 truncate text-sm text-zinc-100">
            {processJobId ?? "Not started"}
          </p>
        </div>

        {requestError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {requestError}
          </div>
        )}

        {downloadJobStatus?.error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Download error: {downloadJobStatus.error}
          </div>
        )}

        {processJobStatus?.error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Process error: {processJobStatus.error}
          </div>
        )}
      </div>
    </section>
  );
}
