"use client";

import { useRef, useState } from "react";
import { DEMO_CLIPS } from "./demoClips";

const PLACEHOLDER_GRADIENTS = [
  "bg-gradient-to-br from-purple-950 to-zinc-900",
  "bg-gradient-to-br from-blue-950 to-zinc-900",
  "bg-gradient-to-br from-green-950 to-zinc-900",
];

type ClipPickerProps = {
  audioUnlocked: boolean;
  selectedClipIndex: number | null;
  onAudioUnlock: () => void;
  onSelect: (index: number | null) => void;
};

export function ClipPicker({ audioUnlocked, selectedClipIndex, onAudioUnlock, onSelect }: ClipPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null]);

  function muteAll(exceptIndex?: number) {
    videoRefs.current.forEach((video, i) => {
      if (video && i !== exceptIndex) video.muted = true;
    });
  }

  function tryUnmute(video: HTMLVideoElement) {
    if (!audioUnlocked) return;
    video.muted = false;
    if (video.paused) video.play().catch(() => { video.muted = true; });
  }

  function handleMouseEnter(index: number) {
    setHoveredIndex(index);
    muteAll(index);
    const video = videoRefs.current[index];
    if (video) {
      if (selectedClipIndex === null) tryUnmute(video);
      if (video.paused) video.play().catch(() => {});
    }
  }

  function handleMouseLeave(index: number) {
    setHoveredIndex(null);
    const video = videoRefs.current[index];
    if (video) {
      video.muted = true;
      if (video.paused) video.play().catch(() => {});
    }
  }

  function handleClick(index: number) {
    if (index === selectedClipIndex) {
      muteAll();
      onSelect(null);
      return;
    }
    onAudioUnlock();
    muteAll(index);
    const video = videoRefs.current[index];
    if (video) {
      video.muted = false;
      video.play().catch(() => { video.muted = true; });
    }
    onSelect(index);
  }

  return (
    <section className="px-6 py-12">
      <div className="flex items-end justify-center gap-6">
        {DEMO_CLIPS.map((clip, index) => {
          const isSelected = selectedClipIndex === index;
          const isActive = hoveredIndex === index || isSelected;

          return (
            <button
              key={index}
              type="button"
              className={`relative w-72 overflow-hidden rounded-xl border-2 transition-all duration-200 ease-out text-left
                ${isActive
                  ? "z-20 scale-125 -translate-y-3 border-[#9146FF] shadow-[0_0_40px_rgba(145,70,255,0.5),0_20px_60px_rgba(0,0,0,0.8)]"
                  : "border-zinc-700 hover:border-zinc-500"
                }`}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={() => handleMouseLeave(index)}
              onClick={() => handleClick(index)}
            >
              {isSelected && (
                <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#9146FF]">
                  <span className="text-[11px] font-bold text-white">&#10003;</span>
                </div>
              )}

              <div className="relative h-44 bg-zinc-800">
                {clip.videoSrc ? (
                  <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    src={clip.videoSrc}
                    autoPlay muted loop playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className={`h-full w-full ${PLACEHOLDER_GRADIENTS[index]}`} />
                )}

                <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-200">
                  {clip.duration}
                </div>
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />

                {isActive && (
                  <div className="absolute bottom-2 right-2 flex items-end gap-0.5">
                    {[6, 10, 7, 12].map((h, i) => (
                      <div
                        key={i}
                        className="animate-audio-bar w-1 rounded-sm bg-[#9146FF]"
                        style={{ height: h, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 p-3">
                <p className={`text-sm font-semibold ${isActive ? "text-zinc-100" : "text-zinc-400"}`}>
                  {clip.title}
                </p>
                <p className={`mt-0.5 text-xs ${isActive ? "text-[#9146FF]" : "text-zinc-600"}`}>
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
