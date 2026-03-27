"use client";

type TwitchUrlPanelProps = {
  clipUrl: string;
  onClipUrlChange: (value: string) => void;
};

export function TwitchUrlPanel({
  clipUrl,
  onClipUrlChange,
}: TwitchUrlPanelProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Twitch Clip URL</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Paste a Twitch clip URL and process it directly.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <label
          htmlFor="clipUrlLarge"
          className="mb-2 block text-sm font-medium text-zinc-200"
        >
          Twitch clip URL
        </label>
        <input
          id="clipUrlLarge"
          type="text"
          value={clipUrl}
          onChange={(event) => onClipUrlChange(event.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
          placeholder="https://clips.twitch.tv/YourClipSlug"
        />
        <p className="mt-3 text-sm text-zinc-500">
          Use this mode for direct pasted URLs without going through the Twitch
          clips browser.
        </p>
      </div>
    </div>
  );
}
