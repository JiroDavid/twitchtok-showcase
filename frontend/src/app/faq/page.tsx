import Image from "next/image";

const FAQS = [
  {
    q: "What is TwitchTok?",
    a: "TwitchTok is an AI-powered pipeline that turns raw Twitch clips into short-form vertical videos ready for TikTok, Reels, or YouTube Shorts - automatically. It handles speech transcription, caption styling, layout cropping, and TikTok metadata generation with no manual editing required.",
  },
  {
    q: "How does the live demo work?",
    a: "The demo uses three pre-selected Twitch clips with AI-generated captions already baked in. When you pick a clip and choose a style, the backend runs a real FFmpeg subtitle burn-in job on the fly and streams back the result. The captions, speaker colours, and layout are all produced by the same AI pipeline used in the full app.",
  },
  {
    q: "What AI models power it?",
    a: "Whisper (OpenAI) handles speech transcription and timestamp generation. FFmpeg burns styled captions onto the video. An optional local Ollama LLM writes the TikTok title, hook, hashtags, and posting schedule. Everything runs locally - no third-party video APIs.",
  },
  {
    q: "Can I use it with my own clips?",
    a: "Yes - head to the App page. You can paste a Twitch clip URL, upload a file directly, or log in with Twitch to browse your own clips. The full pipeline runs on demand: Whisper transcribes, you style the captions, and FFmpeg renders the final vertical video.",
  },
  {
    q: "What does 'multi-speaker' support mean?",
    a: "The caption system supports two simultaneous speaker tracks. Each track can have its own colour, so viewers can follow who is talking at a glance - useful for co-streams, interviews, or any clip with two on-screen voices.",
  },
  {
    q: "Is the source code available?",
    a: "The project was built as a Computer Science dissertation at UAL. The codebase lives on GitHub at github.com/JiroDavid. Feel free to reach out if you'd like to know more.",
  },
];

const GRAPHS: { src: string; caption: string; description: string }[] = [
  {
    src: "/graphs/fig1_task_completion_time.png",
    caption: "Fig 1 - Task completion time: AI vs Manual mode",
    description:
      "All 6 participants completed the AI-mode task within the 7-minute cap (mean 396s). Every manual-mode attempt hit the 12-minute ceiling, a statistically significant difference (Wilcoxon W = 0.0, p = 0.031, Cohen's d_z = -3.76).",
  },
  {
    src: "/graphs/fig2_sus_scores.png",
    caption: "Fig 2 - System Usability Scale: AI vs Manual mode",
    description:
      "AI mode averaged a SUS score of 92.5 (\"Excellent\"). Manual mode averaged 69.6, falling just above the acceptability threshold - with two participants rating it below 35.",
  },
  {
    src: "/graphs/fig3_nasa_tlx_totals.png",
    caption: "Fig 3 - NASA-TLX raw totals: AI vs Manual mode",
    description:
      "AI mode produced substantially lower perceived workload across all 6 participants (mean 100.2 vs 127.2). The difference is significant (Wilcoxon W = 0.0, p = 0.031, Cohen's d_z = -1.58).",
  },
  {
    src: "/graphs/fig4_nasa_tlx_dimension_means.png",
    caption: "Fig 4 - NASA-TLX dimension means",
    description:
      "AI mode rated near-zero on Mental, Physical, Temporal, Effort, and Frustration dimensions. Manual mode showed notably higher Frustration (6.0 vs 1.0) and Temporal demand (31.5 vs 1.5).",
  },
  {
    src: "/graphs/fig5_manual_subtitle_completion.png",
    caption: "Fig 5 - Manual subtitle completion at 12-minute cap",
    description:
      "Even with 12 minutes, participants completed only an average of 31.9% of the clip's subtitles manually. AI mode achieved 100% completion for every participant.",
  },
  {
    src: "/graphs/fig6_paired_slope_chart.png",
    caption: "Fig 6 - Per-participant change across all three metrics",
    description:
      "The slope chart shows consistent individual-level improvement in all three metrics when switching from Manual to AI mode - SUS up, NASA-TLX workload down, and completion time down.",
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-20">

        {/* About me */}
        <section>
          <h1 className="text-3xl font-bold text-zinc-100">About me</h1>
          <p className="mt-4 text-zinc-400 leading-relaxed max-w-2xl">
            CS graduate from UAL. I build tools for creators and gamers - full-stack apps with AI
            and ML pipelines baked in. Fullstack development is my bread and butter, but I also have
            a passion for design and UX.
          </p>
          <p className="mt-3 text-zinc-400 leading-relaxed max-w-2xl">
            I&apos;m currently looking for new opportunities and available from July 2026. Feel free to reach out.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Portfolio", value: "jirodavid.dev", href: "https://jirodavid.dev" },
              { label: "Email", value: "jirodavid153@gmail.com", href: "mailto:jirodavid153@gmail.com" },
              { label: "GitHub", value: "github.com/JiroDavid", href: "https://github.com/JiroDavid" },
              { label: "LinkedIn", value: "linkedin.com/in/jirodavid", href: "https://linkedin.com/in/jirodavid" },
              { label: "Location", value: "London, UK · open to remote" },
              { label: "Phone", value: "07555 979 116", href: "tel:07555979116" },
            ].map(({ label, value, href }) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
                {href ? (
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="mt-1 block text-sm font-medium text-[#9146FF] hover:underline break-all"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#9146FF]/40 bg-[#9146FF]/10 px-4 py-2 text-sm font-medium text-[#9146FF]">
            <span className="h-2 w-2 rounded-full bg-[#9146FF] animate-pulse" />
            Open to dev roles · available Jul 2026
          </div>
        </section>

        {/* About the project */}
        <section>
          <h2 className="text-2xl font-bold text-zinc-100">About the project</h2>
          <p className="mt-4 text-zinc-400 leading-relaxed max-w-2xl">
            TwitchTok started as my CS dissertation at UAL. The goal: reduce the time and effort it
            takes for streamers to repurpose their content for short-form platforms. The full pipeline
            handles everything from transcription to final render - Whisper for captions, FFmpeg for
            video processing, and an optional local LLM for TikTok metadata generation.
          </p>
          <p className="mt-3 text-zinc-400 leading-relaxed max-w-2xl">
            The demo on this site showcases the output quality with three real Twitch clips. The
            caption system supports two simultaneous speaker tracks with per-speaker colour coding,
            and every style choice you make triggers a live FFmpeg render on the backend.
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["Next.js", "FastAPI", "Whisper", "FFmpeg", "Python", "TypeScript", "Tailwind", "Ollama"].map((tech) => (
              <div
                key={tech}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-zinc-300"
              >
                {tech}
              </div>
            ))}
          </div>
        </section>

        {/* User testing */}
        <section>
          <h2 className="text-2xl font-bold text-zinc-100">User testing results</h2>
          <p className="mt-4 text-zinc-400 leading-relaxed max-w-2xl">
            The study used a within-subjects counterbalanced design with 6 participants, comparing
            the AI-powered pipeline against a manual subtitle workflow. Three standardised measures
            were collected: task completion time, System Usability Scale (SUS), and NASA-TLX
            perceived workload.
          </p>

          <div className="mt-10 space-y-14">
            {GRAPHS.map(({ src, caption, description }) => (
              <figure key={src} className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  <Image
                    src={src}
                    alt={caption}
                    width={1200}
                    height={700}
                    className="w-full object-contain"
                  />
                </div>
                <figcaption className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-300">{caption}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">{description}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold text-zinc-100">FAQ</h2>
          <dl className="mt-6 space-y-6">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-5">
                <dt className="font-semibold text-zinc-100">{q}</dt>
                <dd className="mt-2 text-sm text-zinc-400 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

      </div>
    </main>
  );
}
