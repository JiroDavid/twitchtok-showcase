"use client";

import { useRef, useState } from "react";
import { DEMO_CLIPS } from "./demoClips";

const PLACEHOLDER_GRADIENTS = [
  "bg-gradient-to-br from-purple-950 to-zinc-900",
  "bg-gradient-to-br from-blue-950 to-zinc-900",
  "bg-gradient-to-br from-green-950 to-zinc-900",
];

type ClipPickerProps = {
  selectedClipIndex: number | null;
  onSelect: (index: number) => void;
};

export function ClipPicker({ selectedClipIndex, onSelect }: ClipPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null]);

  function handleMouseEnter(index: number) {
    setHoveredIndex(index);
    const video = videoRefs.current[index];
    if (video) {
      try {
        video.muted = false;
      } catch {
        // Browser autoplay policy may block unmuting without a user gesture
      }
    }
  }

  function handleMouseLeave(index: number) {
    setHoveredIndex(null);
    if (index !== selectedClipIndex) {
      const video = videoRefs.current[index];
      if (video) video.muted = true;
    }
  }

  return (
    <section className="px-6 py-12">
      <div className="flex items-end justify-center gap-5">
        {DEMO_CLIPS.map((clip, index) => {
          const isSelected = selectedClipIndex === index;
          const isActive = hoveredIndex === index || isSelected;

          return (
            <button
              key={index}
              type="button"
              className={`relative w-48 overflow-hidden rounded-xl border-2 transition-all duration-150 ease-out text-left
                ${isActive
                  ? "scale-105 -translate-y-1 border-[#9146FF] shadow-[0_0_24px_rgba(145,70,255,0.35)]"
                  : "border-zinc-700 hover:border-zinc-500"
                }`}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={() => handleMouseLeave(index)}
              onClick={() => onSelect(index)}
            >
              {isSelected && (
                <div className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#9146FF]">
                  <span className="text-[10px] font-bold text-white">&#10003;</span>
                </div>
              )}

              <div className="relative h-28 bg-zinc-800">
                {clip.videoSrc ? (
                  <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    src={clip.videoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className={`h-full w-full ${PLACEHOLDER_GRADIENTS[index]}`} />
                )}

                <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200">
                  {clip.duration}
                </div>
                <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />

                {isActive && (
                  <div className="absolute bottom-2 right-2 flex items-end gap-0.5">
                    {[6, 10, 7, 12].map((h, i) => (
                      <div
                        key={i}
                        className="animate-audio-bar w-0.5 rounded-sm bg-[#9146FF]"
                        style={{ height: h, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 p-2.5">
                <p className={`text-[11px] font-semibold ${isActive ? "text-zinc-100" : "text-zinc-400"}`}>
                  {clip.title}
                </p>
                <p className={`mt-0.5 text-[10px] ${isActive ? "text-[#9146FF]" : "text-zinc-600"}`}>
                  {isSelected ? "Selected ✓" : isActive ? "▶ Playing with audio" : "▶ Auto-playing"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
