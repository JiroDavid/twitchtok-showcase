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
  statusTone: string;
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
  statusTone,
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
          <h2 className="text-lg font-semibold">Job Activity</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Compact pipeline status for the current run.
          </p>
        </div>

        <span className={`text-sm font-semibold ${statusTone}`}>
          {getPipelineStageLabel(overallStatus)}
        </span>
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
          <p className="mt-1 text-sm font-semibold text-zinc-100">
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
