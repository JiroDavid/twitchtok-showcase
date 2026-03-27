"use client";

import type { RefObject } from "react";

import type {
  JobStatusResponse,
  PipelineStage,
  ProcessJobResult,
} from "../types";

type OutputPreviewPanelProps = {
  outputVideoUrl: string | null;
  pipelineMessage: string;
  pipelineStage: PipelineStage;
  processJobStatus: JobStatusResponse | null;
  sectionRef: RefObject<HTMLDivElement | null>;
  statusTone: string;
};

export function OutputPreviewPanel({
  outputVideoUrl,
  pipelineMessage,
  pipelineStage,
  processJobStatus,
  sectionRef,
  statusTone,
}: OutputPreviewPanelProps) {
  const processResult = processJobStatus?.result as ProcessJobResult | null;

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

        {processResult ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
            {processResult.layout ?? "N/A"} layout
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Pipeline status
            </p>
            <p className={`mt-1 text-sm font-semibold ${statusTone}`}>
              {pipelineStage}
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
            <p className="mt-2">{processResult.layout ?? "N/A"}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Output URL
            </p>
            <p className="mt-2 break-all">{processResult.output_url ?? "N/A"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
