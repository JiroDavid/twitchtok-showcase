"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LayoutOption = "cropped" | "fullscreen" | "stacked";
type SourceMode = "twitch_url" | "downloaded_file";

type JobCreateResponse = {
  job_id: string;
  status: string;
};

type DownloadJobResult = {
  clip_slug?: string;
  download_path?: string;
  filename?: string;
  source_type?: string;
};

type ProcessJobResult = {
  output_path?: string;
  filename?: string;
  layout?: string;
  output_url?: string;
};

type JobStatusResponse = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: DownloadJobResult | ProcessJobResult | null;
  error: string | null;
};

type DownloadedClip = {
  filename: string;
  download_path: string;
  url: string;
};

type DownloadedClipsResponse = {
  clips: DownloadedClip[];
  count: number;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url?: string;
};

type TwitchClip = {
  id: string;
  url: string;
  embed_url?: string;
  title?: string;
  creator_name?: string;
  thumbnail_url?: string;
  view_count?: number;
  created_at?: string;
  duration?: number;
  vod_offset?: number | null;
};

type OAuthPayload = {
  message: string;
  user: TwitchUser;
  clips: TwitchClip[];
  clip_count: number;
  token_type?: string;
  expires_in?: number;
  scope?: string[];
};

const API_BASE_URL = "http://localhost:8000";

export default function Home() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("twitch_url");

  const [clipUrl, setClipUrl] = useState(
    "https://clips.twitch.tv/AuspiciousAnimatedDelicataSoonerLater-0B3bBhlmYjXEWKEs"
  );
  const [layout, setLayout] = useState<LayoutOption>("cropped");

  const [downloadedClips, setDownloadedClips] = useState<DownloadedClip[]>([]);
  const [selectedDownloadedPath, setSelectedDownloadedPath] = useState("");

  const [downloadJobId, setDownloadJobId] = useState<string | null>(null);
  const [downloadJobStatus, setDownloadJobStatus] =
    useState<JobStatusResponse | null>(null);

  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

  const [processJobId, setProcessJobId] = useState<string | null>(null);
  const [processJobStatus, setProcessJobStatus] =
    useState<JobStatusResponse | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [twitchUser, setTwitchUser] = useState<TwitchUser | null>(null);
  const [twitchClips, setTwitchClips] = useState<TwitchClip[]>([]);
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);

  const outputVideoUrl = useMemo(() => {
    const result = processJobStatus?.result as ProcessJobResult | null;
    const outputUrl = result?.output_url;
    if (!outputUrl) return null;
    return `${API_BASE_URL}${outputUrl}`;
  }, [processJobStatus]);

  useEffect(() => {
    async function fetchDownloadedClips() {
      try {
        const response = await fetch(`${API_BASE_URL}/clips/downloaded`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch downloaded clips (${response.status}): ${errorText}`
          );
        }

        const data: DownloadedClipsResponse = await response.json();
        setDownloadedClips(data.clips);

        if (data.clips.length > 0 && !selectedDownloadedPath) {
          setSelectedDownloadedPath(data.clips[0].download_path);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error fetching downloaded clips";
        setRequestError(message);
      }
    }

    fetchDownloadedClips();
  }, [selectedDownloadedPath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const payloadParam = params.get("payload");
    const errorMessage = params.get("message");

    if (!oauth) return;

    if (oauth === "success" && payloadParam) {
      try {
        const decodedPayload = decodeURIComponent(payloadParam);
        const parsedPayload: OAuthPayload = JSON.parse(decodedPayload);

        setTwitchUser(parsedPayload.user);
        setTwitchClips(parsedPayload.clips ?? []);
        setOauthStatus("success");

        if ((parsedPayload.clips ?? []).length > 0) {
          setSourceMode("twitch_url");
        }
      } catch (error) {
        console.error("Failed to parse OAuth payload:", error);
        setRequestError("OAuth succeeded, but the returned payload could not be read.");
        setOauthStatus("error");
      }
    }

    if (oauth === "error") {
      setOauthStatus("error");
      setRequestError(errorMessage ?? "Twitch OAuth failed.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setRequestError(null);

    setDownloadJobId(null);
    setDownloadJobStatus(null);
    setDownloadedPath(null);

    setProcessJobId(null);
    setProcessJobStatus(null);

    try {
      if (sourceMode === "twitch_url") {
        const response = await fetch(`${API_BASE_URL}/jobs/download-clip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clip_url: clipUrl,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create download job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setDownloadJobId(data.job_id);
      } else {
        if (!selectedDownloadedPath) {
          throw new Error("Please select a downloaded file.");
        }

        const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input_path: selectedDownloadedPath,
            layout,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create process job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setProcessJobId(data.job_id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";
      setRequestError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLoginWithTwitch() {
    window.location.href = `${API_BASE_URL}/auth/twitch/login`;
  }

  function handleUseClip(clip: TwitchClip) {
    setSourceMode("twitch_url");
    setClipUrl(clip.url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogoutTwitch() {
    setTwitchUser(null);
    setTwitchClips([]);
    setOauthStatus(null);
  }

  useEffect(() => {
    if (!downloadJobId) return;

    let intervalId: ReturnType<typeof setInterval>;

    async function fetchDownloadJobStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${downloadJobId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch download job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setDownloadJobStatus(data);

        if (data.status === "completed") {
          const result = data.result as DownloadJobResult | null;
          const path = result?.download_path;

          if (!path) {
            setRequestError(
              "Download job completed but no download_path was returned."
            );
            clearInterval(intervalId);
            return;
          }

          setDownloadedPath(path);
          clearInterval(intervalId);
          return;
        }

        if (data.status === "failed") {
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown download polling error";
        setRequestError(message);
        clearInterval(intervalId);
      }
    }

    fetchDownloadJobStatus();
    intervalId = setInterval(fetchDownloadJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [downloadJobId]);

  useEffect(() => {
    if (!downloadedPath) return;
    if (processJobId) return;

    async function startProcessJob() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input_path: downloadedPath,
            layout,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create process job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setProcessJobId(data.job_id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process request error";
        setRequestError(message);
      }
    }

    startProcessJob();
  }, [downloadedPath, layout, processJobId]);

  useEffect(() => {
    if (!processJobId) return;

    let intervalId: ReturnType<typeof setInterval>;

    async function fetchProcessJobStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${processJobId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch process job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setProcessJobStatus(data);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process polling error";
        setRequestError(message);
        clearInterval(intervalId);
      }
    }

    fetchProcessJobStatus();
    intervalId = setInterval(fetchProcessJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [processJobId]);

  const overallStatus =
    processJobStatus?.status ??
    downloadJobStatus?.status ??
    (isSubmitting ? "submitting" : "idle");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-violet-400">
              Dissertation Project
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              AI-Assisted Twitch Clip Editing
            </h1>
            <p className="mt-4 max-w-3xl text-base text-zinc-400 sm:text-lg">
              Process Twitch clips into vertical videos using either a pasted clip
              URL, your authenticated Twitch clips, or an already downloaded test file.
            </p>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold">Twitch Account</h2>

            {!twitchUser ? (
              <>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Log in with Twitch to load your recent clips directly into the editor.
                </p>
                <button
                  type="button"
                  onClick={handleLoginWithTwitch}
                  className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
                >
                  Login with Twitch
                </button>
              </>
            ) : (
              <div className="mt-4">
                <div className="flex items-center gap-4">
                  {twitchUser.profile_image_url ? (
                    <img
                      src={twitchUser.profile_image_url}
                      alt={twitchUser.display_name}
                      className="h-14 w-14 rounded-full border border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-sm text-zinc-400">
                      N/A
                    </div>
                  )}

                  <div>
                    <p className="text-base font-semibold text-zinc-100">
                      {twitchUser.display_name}
                    </p>
                    <p className="text-sm text-zinc-400">@{twitchUser.login}</p>
                    {twitchUser.email && (
                      <p className="text-xs text-zinc-500">{twitchUser.email}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                  <span className="text-zinc-400">OAuth status</span>
                  <span className="font-medium text-green-400">
                    {oauthStatus ?? "connected"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutTwitch}
                  className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                >
                  Clear Twitch Session
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Input Source</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Keep Twitch URL ingest for real workflow, and keep downloaded file
              mode for fast backend testing.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceMode("twitch_url")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  sourceMode === "twitch_url"
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                Twitch Clip URL
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("downloaded_file")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  sourceMode === "downloaded_file"
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                Downloaded File
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {sourceMode === "twitch_url" ? (
                <div>
                  <label
                    htmlFor="clipUrl"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Twitch clip URL
                  </label>
                  <input
                    id="clipUrl"
                    type="text"
                    value={clipUrl}
                    onChange={(event) => setClipUrl(event.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                    placeholder="https://clips.twitch.tv/YourClipSlug"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="downloadedFile"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Downloaded file
                  </label>
                  <select
                    id="downloadedFile"
                    value={selectedDownloadedPath}
                    onChange={(event) =>
                      setSelectedDownloadedPath(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                  >
                    {downloadedClips.length === 0 ? (
                      <option value="">No downloaded files found</option>
                    ) : (
                      downloadedClips.map((clip) => (
                        <option
                          key={clip.download_path}
                          value={clip.download_path}
                        >
                          {clip.filename}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="layout"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Layout
                </label>
                <select
                  id="layout"
                  value={layout}
                  onChange={(event) =>
                    setLayout(event.target.value as LayoutOption)
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                >
                  <option value="cropped">cropped</option>
                  <option value="fullscreen">fullscreen</option>
                  <option value="stacked">stacked</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Submitting..."
                  : sourceMode === "twitch_url"
                  ? "Download and Process"
                  : "Process Downloaded File"}
              </button>
            </form>

            <div className="mt-6 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
              <div>
                <span className="text-zinc-500">Mode:</span>{" "}
                <span className="text-zinc-200">{sourceMode}</span>
              </div>

              <div>
                <span className="text-zinc-500">Overall status:</span>{" "}
                <span className="text-zinc-200">{overallStatus}</span>
              </div>

              <div>
                <span className="text-zinc-500">Download job ID:</span>{" "}
                <span className="break-all text-zinc-200">
                  {downloadJobId ?? "Not started"}
                </span>
              </div>

              <div>
                <span className="text-zinc-500">Downloaded path:</span>{" "}
                <span className="break-all text-zinc-200">
                  {downloadedPath ?? "Not available yet"}
                </span>
              </div>

              <div>
                <span className="text-zinc-500">Process job ID:</span>{" "}
                <span className="break-all text-zinc-200">
                  {processJobId ?? "Not started"}
                </span>
              </div>

              {downloadJobStatus?.error && (
                <div className="text-red-400">
                  <span className="font-medium">Download error:</span>{" "}
                  {downloadJobStatus.error}
                </div>
              )}

              {processJobStatus?.error && (
                <div className="text-red-400">
                  <span className="font-medium">Process error:</span>{" "}
                  {processJobStatus.error}
                </div>
              )}

              {requestError && (
                <div className="text-red-400">
                  <span className="font-medium">Request error:</span>{" "}
                  {requestError}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Your Twitch Clips</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                After Twitch login, choose one of your clips and feed it into the
                existing processing workflow.
              </p>

              <div className="mt-6">
                {!twitchUser ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-500">
                    No Twitch account connected yet. Use the login button above to
                    load recent clips.
                  </div>
                ) : twitchClips.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-500">
                    Twitch login succeeded, but no clips were returned.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {twitchClips.map((clip) => (
                      <div
                        key={clip.id}
                        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
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
                          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">
                            {clip.title || "Untitled clip"}
                          </h3>

                          <div className="mt-3 space-y-1 text-xs text-zinc-400">
                            <p>Creator: {clip.creator_name ?? "Unknown"}</p>
                            <p>Views: {clip.view_count ?? 0}</p>
                            <p>
                              Created:{" "}
                              {clip.created_at
                                ? new Date(clip.created_at).toLocaleString()
                                : "Unknown"}
                            </p>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUseClip(clip)}
                              className="flex-1 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
                            >
                              Use this clip
                            </button>

                            <a
                              href={clip.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                            >
                              Open
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Output Preview</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Once processing completes, the rendered video will appear here.
              </p>

              <div className="mt-6 flex min-h-[640px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
                {outputVideoUrl ? (
                  <video
                    key={outputVideoUrl}
                    controls
                    className="max-h-[600px] rounded-xl border border-zinc-800"
                    src={outputVideoUrl}
                  />
                ) : (
                  <div className="text-center text-sm text-zinc-500">
                    No processed video yet. Submit a job to preview the output.
                  </div>
                )}
              </div>

              {processJobStatus?.result && (
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                  <p>
                    <span className="text-zinc-500">Filename:</span>{" "}
                    {(processJobStatus.result as ProcessJobResult).filename ??
                      "N/A"}
                  </p>
                  <p className="mt-2">
                    <span className="text-zinc-500">Layout:</span>{" "}
                    {(processJobStatus.result as ProcessJobResult).layout ?? "N/A"}
                  </p>
                  <p className="mt-2 break-all">
                    <span className="text-zinc-500">Output URL:</span>{" "}
                    {(processJobStatus.result as ProcessJobResult).output_url ??
                      "N/A"}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}