"use client";

type RevealPanelProps = {
  outputUrl: string;
  onReset: () => void;
  onOpenSubtitleEditor: () => void;
  onOpenCropEditor: () => void;
};

export function RevealPanel({ outputUrl, onReset, onOpenSubtitleEditor, onOpenCropEditor }: RevealPanelProps) {
  return (
    <section className="py-20">
      <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 4 -- Your Highlight
      </p>

      <div className="flex flex-wrap items-center justify-center gap-16">
        {/* Phone frame -- scale-up entrance via animate-reveal-phone class */}
        <div className="animate-reveal-phone w-36 rounded-3xl border-2 border-[#9146FF] bg-zinc-950 p-1.5 shadow-[0_0_48px_rgba(145,70,255,0.35),0_16px_48px_rgba(0,0,0,0.7)]">
          <div className="flex h-3 items-center justify-center rounded-t-lg bg-zinc-900">
            <div className="h-1 w-5 rounded-full bg-zinc-700" />
          </div>
          <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "9 / 16" }}>
            <video
              src={outputUrl}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-0.5 flex h-2.5 items-center justify-center rounded-b-lg bg-zinc-900">
            <div className="h-1 w-6 rounded-full bg-zinc-700" />
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
            <div className="flex gap-2">
              <button
                onClick={onOpenSubtitleEditor}
                className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-medium text-violet-300 transition-all hover:border-violet-400 hover:bg-violet-500/20"
              >
                ✏️ Edit Subtitles
              </button>
              <button
                onClick={onOpenCropEditor}
                className="flex-1 rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-medium text-green-300 transition-all hover:border-green-400 hover:bg-green-500/20"
              >
                ✂️ Adjust Crop
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
