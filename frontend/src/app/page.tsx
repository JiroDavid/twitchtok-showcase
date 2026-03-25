export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <div className="mb-10">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-violet-400">
            Dissertation Project
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI-Assisted Twitch Clip Editing
          </h1>
          <p className="mt-4 max-w-2xl text-base text-zinc-400 sm:text-lg">
            A web-based system for transforming Twitch clips into vertical
            short-form videos for TikTok and YouTube Shorts, while preserving
            editor control.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-100">Backend MVP</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              FastAPI backend with Twitch clip resolution, downloading,
              background job processing, and FFmpeg vertical render presets.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-100">Render Modes</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Current presets include cropped, fullscreen, and stacked vertical
              layouts, with manual stacked crop support already available in the
              backend.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-100">Next Step</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Build the first frontend processing flow: choose input, select
              layout, submit a job, poll status, and preview the result.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}