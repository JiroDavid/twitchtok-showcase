export function DemoHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-20 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1c1020] via-zinc-950 to-zinc-950" />
      <div className="relative">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9146FF]">
          AI-Powered Short-Form Video
        </p>
        <h1 className="text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Turn Twitch clips
          <br />
          <span className="text-[#9146FF]">into viral shorts</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-500">in seconds, automatically</p>
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <span>&#8595;</span>
          <span>Pick a clip below to try it live</span>
        </div>
      </div>
    </section>
  );
}
