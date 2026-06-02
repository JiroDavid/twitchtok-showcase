"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  "Analysing video content...",
  "Whisper transcribing audio...",
  "Applying your style...",
  "Rendering vertical format...",
  "Finishing up...",
];

const MESSAGE_DELAYS_MS = [0, 1500, 3500, 5500, 7500];

type ProcessingWindowProps = {
  selectedClipIndex: number;
  outputUrlPromise?: Promise<string | null>;
  onComplete: (outputUrl: string) => void;
};

export function ProcessingWindow({
  selectedClipIndex,
  outputUrlPromise,
  onComplete,
}: ProcessingWindowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [doneIndices, setDoneIndices] = useState<Set<number>>(new Set());

  const jobOutputUrlRef = useRef<string | null>(null);
  const onCompleteRef   = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Timed message sequence. The last message stays active (spinning) until
  // the render job resolves — no fixed fallback timer, no URL flash.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const fallback = `/demo_cache/clip${selectedClipIndex + 1}/output.mp4?t=${Date.now()}`;

    MESSAGE_DELAYS_MS.forEach((delay, index) => {
      timers.push(
        setTimeout(() => {
          setActiveIndex(index);
          if (index > 0) {
            setDoneIndices((prev) => new Set([...prev, index - 1]));
          }

          if (index === MESSAGES.length - 1) {
            // Poll until the render URL lands (or 25s hard timeout)
            const deadline = Date.now() + 25_000;
            const poll = () => {
              const url = jobOutputUrlRef.current;
              if (url) {
                setDoneIndices((prev) => new Set([...prev, index]));
                onCompleteRef.current(url);
              } else if (Date.now() >= deadline) {
                setDoneIndices((prev) => new Set([...prev, index]));
                onCompleteRef.current(fallback);
              } else {
                timers.push(setTimeout(poll, 400));
              }
            };
            timers.push(setTimeout(poll, 500));
          }
        }, delay),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Resolve output URL — just set the ref; the poll loop above picks it up
  useEffect(() => {
    const fallback = `/demo_cache/clip${selectedClipIndex + 1}/output.mp4?t=${Date.now()}`;
    if (outputUrlPromise) {
      outputUrlPromise
        .then((url) => { jobOutputUrlRef.current = url ?? fallback; })
        .catch(() => { jobOutputUrlRef.current = fallback; });
    } else {
      jobOutputUrlRef.current = fallback;
    }
  }, [selectedClipIndex, outputUrlPromise]);

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
