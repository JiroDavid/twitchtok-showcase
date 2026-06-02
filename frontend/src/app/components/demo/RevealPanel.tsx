"use client";

import { useRef, useState } from "react";
import type { LayoutOption } from "../../types";

const CLIP_METADATA = [
  {
    title: "He actually broke 💀",
    description: "Ludwig loses it after getting knocked out of a League of Legends tournament. The crash out is real.",
    hashtags: ["#fyp", "#twitch", "#livestream", "#ludwig", "#leagueoflegends", "#gaming", "#crashout"],
  },
  {
    title: "She handed him a TOAD 🐸",
    description: "Maya brings a toad from her animal sanctuary and hands it straight to Jason. His reaction says it all.",
    hashtags: ["#fyp", "#twitch", "#livestream", "#maya", "#jasontheween", "#offlinetv", "#frog", "#animals"],
  },
  {
    title: "Leeloo Dallas Multipass 🎬",
    description: "Stable Ronaldo interviews Cyr (as Zorg) and Peach (as Leeloo Dallas) at the Streamer Awards. Unhinged cinema.",
    hashtags: ["#fyp", "#twitch", "#livestream", "#streamerawards", "#cosplay", "#leeloodallas", "#fifthelement", "#stableronaldo"],
  },
];

type RevealPanelProps = {
  outputUrl: string;
  layout?: LayoutOption;
  selectedClipIndex?: number | null;
  isProcessing?: boolean;
  processingError?: string | null;
  onReset: () => void;
  onOpenSubtitleEditor: () => void;
  onOpenCropEditor: () => void;
};

export function RevealPanel({
  outputUrl,
  layout = "cropped",
  selectedClipIndex = null,
  isProcessing = false,
  processingError = null,
  onReset,
  onOpenSubtitleEditor,
  onOpenCropEditor,
}: RevealPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  return (
    <section className="py-20">
      <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 4 -- Your Highlight
      </p>

      <div className="flex flex-col items-center gap-12">
      <div className="flex flex-wrap items-center justify-center gap-16">
        {/* Phone frame */}
        <div className="animate-reveal-phone w-[26rem] rounded-[44px] border-2 border-[#9146FF] bg-zinc-950 p-3 shadow-[0_0_48px_rgba(145,70,255,0.35),0_16px_48px_rgba(0,0,0,0.7)]">
          <div className="flex h-8 items-center justify-center rounded-t-2xl bg-zinc-900">
            <div className="h-2 w-12 rounded-full bg-zinc-700" />
          </div>
          <div
            className="relative cursor-pointer overflow-hidden rounded-sm bg-black"
            style={{ aspectRatio: "9 / 16" }}
            onClick={togglePlay}
          >
            <video
              ref={videoRef}
              src={outputUrl}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {/* Play/pause overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <svg className="h-10 w-10 translate-x-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            )}
          </div>
          <div className="mt-0.5 flex h-6 items-center justify-center rounded-b-2xl bg-zinc-900">
            <div className="h-2 w-14 rounded-full bg-zinc-700" />
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-xs">
          <h2 className="text-3xl font-black leading-tight text-white">
            Your clip,
            <br />
            <span className="text-[#9146FF]">ready to post</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Captioned, cropped, vertical. Export and post directly to TikTok or Reels.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={outputUrl}
              download
              className="block rounded-lg bg-[#9146FF] py-3 text-center text-sm font-bold text-white shadow-[0_2px_12px_rgba(145,70,255,0.4)] transition-all hover:bg-[#7c3aed] hover:shadow-[0_4px_20px_rgba(145,70,255,0.5)]"
            >
              Download
            </a>
            <button
              onClick={onReset}
              className="rounded-lg bg-zinc-800 py-3 text-sm text-zinc-400 transition-all hover:bg-zinc-700 hover:text-zinc-200"
            >
              Try another clip
            </button>
          </div>
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Want to fine-tune?
            </p>
            {processingError && (
              <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                {processingError}
              </p>
            )}
            {isProcessing ? (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-3 text-xs text-zinc-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-[#9146FF]" />
                Re-rendering... this may take a moment
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onOpenSubtitleEditor}
                  className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-medium text-violet-300 transition-all hover:border-violet-400 hover:bg-violet-500/20"
                >
                  ✏️ Edit Subtitles
                </button>
                {layout !== "cropped" && (
                  <button
                    onClick={onOpenCropEditor}
                    className="flex-1 rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-medium text-green-300 transition-all hover:border-green-400 hover:bg-green-500/20"
                  >
                    ✂️ Adjust Crop
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI-generated TikTok metadata */}
      {selectedClipIndex !== null && CLIP_METADATA[selectedClipIndex] && (() => {
        const meta = CLIP_METADATA[selectedClipIndex];
        return (
          <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-[#9146FF]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
                ✦ AI Generated
              </span>
              <span className="text-[10px] text-zinc-600">TikTok metadata</span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Title</p>
                <p className="text-sm font-bold text-zinc-100">{meta.title}</p>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Description</p>
                <p className="text-sm leading-relaxed text-zinc-400">{meta.description}</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-[#9146FF]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      </div>
    </section>
  );
}
