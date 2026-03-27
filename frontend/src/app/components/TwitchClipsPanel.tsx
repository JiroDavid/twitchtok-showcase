"use client";

import type { TwitchClip, TwitchUser } from "../types";

type TwitchClipsPanelProps = {
  selectedTwitchClip: TwitchClip | null;
  twitchClips: TwitchClip[];
  twitchUser: TwitchUser | null;
  onSelectTwitchClip: (clip: TwitchClip) => void;
  onUseClipAsUrl: (clip: TwitchClip) => void;
};

export function TwitchClipsPanel({
  selectedTwitchClip,
  twitchClips,
  twitchUser,
  onSelectTwitchClip,
  onUseClipAsUrl,
}: TwitchClipsPanelProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your Twitch Clips</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Select a clip as your source, send it into manual URL mode, or open it
            on Twitch.
          </p>
        </div>

        {selectedTwitchClip ? (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            Active clip:{" "}
            <span className="font-semibold">
              {selectedTwitchClip.title || "Untitled clip"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {!twitchUser ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-500">
            No Twitch account connected yet. Use the login button above to load
            recent clips.
          </div>
        ) : twitchClips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-500">
            Twitch login succeeded, but no clips were returned.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {twitchClips.map((clip) => {
              const isSelected = selectedTwitchClip?.id === clip.id;

              return (
                <div
                  key={clip.id}
                  className={`overflow-hidden rounded-2xl border bg-zinc-950 transition ${
                    isSelected
                      ? "border-violet-500 ring-1 ring-violet-500"
                      : "border-zinc-800"
                  }`}
                >
                  {clip.thumbnail_url ? (
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title ?? "Twitch clip thumbnail"}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-zinc-900 text-sm text-zinc-500">
                      No thumbnail
                    </div>
                  )}

                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">
                        {clip.title || "Untitled clip"}
                      </h3>
                      {isSelected ? (
                        <span className="rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1 text-xs text-zinc-400">
                      <p>Creator: {clip.creator_name ?? "Unknown"}</p>
                      <p>Views: {clip.view_count ?? 0}</p>
                      <p>
                        Created:{" "}
                        {clip.created_at
                          ? new Date(clip.created_at).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectTwitchClip(clip)}
                        className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400"
                      >
                        Select
                      </button>

                      <button
                        type="button"
                        onClick={() => onUseClipAsUrl(clip)}
                        className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Use as URL
                      </button>

                      <a
                        href={clip.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-zinc-700 px-3 py-2 text-center text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
