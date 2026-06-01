"use client";

import { useEffect, useRef, useState } from "react";

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
  onComplete: (outputUrl: string) => void;
};

export function ProcessingWindow({
  selectedClipIndex,
  onComplete,
}: ProcessingWindowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [doneIndices, setDoneIndices] = useState<Set<number>>(new Set());

  const messagesFinishedRef = useRef(false);
  const jobOutputUrlRef     = useRef<string | null>(null);
  const onCompleteRef       = useRef(onComplete);
  // eslint-disable-next-line react-hooks/refs
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

  // Resolve to pre-cached output — no live render in demo mode
  useEffect(() => {
    const cachedUrl = `/demo_cache/clip${selectedClipIndex + 1}/output.mp4`;
    jobOutputUrlRef.current = cachedUrl;
    if (messagesFinishedRef.current) {
      onCompleteRef.current(cachedUrl);
    }
  }, [selectedClipIndex]);

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
