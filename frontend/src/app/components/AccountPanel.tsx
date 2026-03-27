"use client";

import type { TwitchUser } from "../types";

type AccountPanelProps = {
  oauthStatus: string | null;
  twitchClipsCount: number;
  twitchUser: TwitchUser | null;
  onLoginWithTwitch: () => void;
  onLogoutTwitch: () => void;
};

export function AccountPanel({
  oauthStatus,
  twitchClipsCount,
  twitchUser,
  onLoginWithTwitch,
  onLogoutTwitch,
}: AccountPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Twitch Account</p>
          <p className="mt-1 text-xs text-zinc-500">
            {twitchUser
              ? "Connected and ready for clip selection."
              : "Connect to load recent clips."}
          </p>
        </div>

        {twitchUser ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Connected
          </span>
        ) : (
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-400">
            Not connected
          </span>
        )}
      </div>

      {!twitchUser ? (
        <button
          type="button"
          onClick={onLoginWithTwitch}
          className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Login with Twitch
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            {twitchUser.profile_image_url ? (
              <img
                src={twitchUser.profile_image_url}
                alt={twitchUser.display_name}
                className="h-12 w-12 rounded-full border border-zinc-700 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-400">
                N/A
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {twitchUser.display_name}
              </p>
              <p className="truncate text-xs text-zinc-400">
                @{twitchUser.login}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                OAuth
              </p>
              <p className="mt-1 text-sm font-semibold text-green-400">
                {oauthStatus ?? "connected"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Loaded clips
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {twitchClipsCount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogoutTwitch}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            Clear Twitch Session
          </button>
        </div>
      )}
    </div>
  );
}
