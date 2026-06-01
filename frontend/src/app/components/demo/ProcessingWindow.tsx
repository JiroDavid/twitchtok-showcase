"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoConfig } from "../../types";
import type { JobCreateResponse, JobStatusResponse, ProcessJobResult } from "../../types";
import { DEMO_CLIPS } from "./demoClips";

const MESSAGES = [
  "Analysing video content...",
  "Whisper transcribing audio...",
  "Applying your style...",
  "Rendering vertical format...",
  "Finishing up...",
];

// Milliseconds after mount when each message becomes active
const MESSAGE_DELAYS_MS = [0, 1500, 3500, 5500, 7500];

type ProcessingWindowProps = {
  selectedClipIndex: number;
  config: DemoConfig;
  onComplete: (outputUrl: string) => void;
  onError: () => void;
};

export function ProcessingWindow({
  selectedClipIndex,
  config,
  onComplete,
  onError,
}: ProcessingWindowProps) {
  const [activeIndex, setActiveIndex]       = useState(0);
  const [doneIndices, setDoneIndices]       = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  // Refs let the polling closure read the latest state without stale captures
  const messagesFinishedRef = useRef(false);
  const jobOutputUrlRef     = useRef<string | null>(null);
  const onCompleteRef       = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Timed message sequence
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    MESSAGE_DELAYS_MS.forEach((delay, index) => {
      timers.push(
        setTimeout(() => {
          setActiveIndex(index);
          if (index > 0) {
            setDoneIndices((prev) => new Set([...prev, index - 1]));
          }

          if (index === MESSAGES.length - 1) {
            // Final message -- mark it done after 1 s then check if job is ready
            timers.push(
              setTimeout(() => {
                setDoneIndices((prev) => new Set([...prev, index]));
                messagesFinishedRef.current = true;
                if (jobOutputUrlRef.current) {
                  onCompleteRef.current(jobOutputUrlRef.current);
                }
              }, 1000),
            );
          }
        }, delay),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Backend job
  useEffect(() => {
    const inputPath = DEMO_CLIPS[selectedClipIndex]?.inputPath ?? "";
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function startJob() {
      try {
        const body = {
          input_path: inputPath,
          layout: config.layout,
          stacked_config: null,
          captions: {
            enabled: true,
            burn_in: true,
            refine_with_llm: false,
            censor_subtitles: false,
            default_style: {
              color: config.color,
              font_family: config.font,
              font_size: 140,
              outline: 8,
              shadow: 3,
            },
          },
          metadata: { enabled: false },
          crop_source: "manual",
        };

        const res = await fetch("/jobs/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Job creation failed (${res.status}): ${text}`);
        }

        const { job_id }: JobCreateResponse = await res.json();

        intervalId = setInterval(async () => {
          try {
            const statusRes = await fetch(`/jobs/${job_id}`);
            if (!statusRes.ok) throw new Error(`Poll failed: ${statusRes.status}`);

            const data: JobStatusResponse = await statusRes.json();

            if (data.status === "completed") {
              if (intervalId) clearInterval(intervalId);
              const result = data.result as ProcessJobResult | null;
              const url = result?.output_url ?? null;
              if (url) {
                jobOutputUrlRef.current = url;
                if (messagesFinishedRef.current) {
                  onCompleteRef.current(url);
                }
              }
            } else if (data.status === "failed") {
              if (intervalId) clearInterval(intervalId);
              setErrorMsg("Processing failed. Please try again.");
            }
          } catch (err) {
            if (intervalId) clearInterval(intervalId);
            setErrorMsg(err instanceof Error ? err.message : "Lost connection to server.");
          }
        }, 2000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      }
    }

    void startJob();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [selectedClipIndex, config]);

  if (errorMsg) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-red-400">{errorMsg}</p>
        <button
          onClick={onError}
          className="mt-4 text-sm text-[#9146FF] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const progress = (doneIndices.size / MESSAGES.length) * 100;

  return (
    <div className="rounded-xl border-l-4 border-[#9146FF] bg-zinc-900 p-6">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 3 -- Processing
      </p>

      <div className="flex flex-col gap-3">
        {MESSAGES.map((message, index) => {
          const isDone    = doneIndices.has(index);
          const isActive  = activeIndex === index && !isDone;
          const isPending = index > activeIndex;

          return (
            <div
              key={index}
              className={`flex items-center gap-3 transition-opacity duration-300 ${isPending ? "opacity-30" : ""}`}
            >
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                  isDone
                    ? "bg-green-500"
                    : isActive
                    ? "bg-[#9146FF]"
                    : "border-2 border-zinc-700"
                }`}
              >
                {isDone && <span className="text-[10px] font-bold text-white">&#10003;</span>}
                {isActive && (
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isDone
                    ? "text-zinc-500 line-through"
                    : isActive
                    ? "font-semibold text-zinc-100"
                    : "text-zinc-600"
                }`}
              >
                {message}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9146FF] to-[#b07eff] transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
