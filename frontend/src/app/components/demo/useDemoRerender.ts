"use client";

import { useState } from "react";
import type { EditableCaptionDraft, LayoutOption, StackedConfig } from "../../types";

async function pollJob(jobId: string): Promise<void> {
  for (;;) {
    const res = await fetch(`/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    const data = await res.json();
    if (data.status === "completed") return;
    if (data.status === "failed") throw new Error(data.error ?? "Job failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function promoteJob(clipIndex: number, jobId: string, layout?: LayoutOption): Promise<void> {
  const res = await fetch(`/demo-cache/${clipIndex}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, ...(layout ? { layout } : {}) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Promote failed (${res.status}): ${text}`);
  }
}

export function useDemoRerender() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerenderSubtitles(
    clipIndex: number,
    captions: EditableCaptionDraft[],
    layout: LayoutOption = "stacked",
  ): Promise<string | null> {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch("/demo-cache/subtitle-rerender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip_index: clipIndex, items: captions, layout }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Subtitle re-render failed (${res.status}): ${text}`);
      }
      const { job_id } = await res.json();
      await pollJob(job_id);
      await promoteJob(clipIndex, job_id, layout);
      return `/demo_cache/clip${clipIndex + 1}/output.mp4?t=${Date.now()}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subtitle re-render failed");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  async function rerenderCrop(
    clipIndex: number,
    stackedConfig: StackedConfig,
  ): Promise<string | null> {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch("/demo-cache/crop-rerender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clip_index: clipIndex,
          stacked_config: stackedConfig,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Crop re-render failed (${res.status}): ${text}`);
      }
      const { job_id } = await res.json();
      await pollJob(job_id);
      await promoteJob(clipIndex, job_id);
      return `/demo_cache/clip${clipIndex + 1}/output.mp4?t=${Date.now()}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crop re-render failed");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  return { isProcessing, error, rerenderSubtitles, rerenderCrop };
}
