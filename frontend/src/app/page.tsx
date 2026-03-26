"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type LayoutOption = "cropped" | "fullscreen" | "stacked";
type SourceMode = "twitch_clips" | "twitch_url" | "downloaded_file";

type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type StackedConfig = {
  top_crop: CropBox;
  bottom_crop: CropBox;
  split_ratio_top: number;
};

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

type DragTarget = "top_crop" | "bottom_crop";
type DragMode = "move" | "resize";

type DragState = {
  target: DragTarget;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startBox: CropBox;
} | null;

const API_BASE_URL = "http://localhost:8000";

const DEFAULT_STACKED_CONFIG: StackedConfig = {
  top_crop: { x: 1340, y: 40, w: 520, h: 520 },
  bottom_crop: { x: 420, y: 0, w: 1080, h: 1080 },
  split_ratio_top: 0.4,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundBox(box: CropBox): CropBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
  };
}

export default function Home() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("twitch_url");

  const [clipUrl, setClipUrl] = useState(
    "https://clips.twitch.tv/AuspiciousAnimatedDelicataSoonerLater-0B3bBhlmYjXEWKEs"
  );
  const [layout, setLayout] = useState<LayoutOption>("cropped");

  const [stackedConfig, setStackedConfig] =
    useState<StackedConfig>(DEFAULT_STACKED_CONFIG);

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
  const [selectedTwitchClip, setSelectedTwitchClip] = useState<TwitchClip | null>(
    null
  );
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);

  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [cropDraft, setCropDraft] = useState<StackedConfig>(DEFAULT_STACKED_CONFIG);
  const [videoNaturalSize, setVideoNaturalSize] = useState({ width: 1920, height: 1080 });
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 1, height: 1 });
  const [dragState, setDragState] = useState<DragState>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const outputVideoUrl = useMemo(() => {
    const result = processJobStatus?.result as ProcessJobResult | null;
    const outputUrl = result?.output_url;
    if (!outputUrl) return null;
    return `${API_BASE_URL}${outputUrl}`;
  }, [processJobStatus]);

  const selectedDownloadedClip = useMemo(() => {
    return downloadedClips.find(
      (clip) => clip.download_path === selectedDownloadedPath
    ) ?? null;
  }, [downloadedClips, selectedDownloadedPath]);

  const cropEditorPreviewUrl = useMemo(() => {
    if (!selectedDownloadedClip) return null;
    return `${API_BASE_URL}${selectedDownloadedClip.url}`;
  }, [selectedDownloadedClip]);

  const stackedConfigIsValid = [stackedConfig.top_crop, stackedConfig.bottom_crop].every(
    (box) =>
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      Number.isFinite(box.w) &&
      Number.isFinite(box.h) &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.w > 0 &&
      box.h > 0
  );

  function buildProcessRequestBody(inputPath: string) {
    return {
      input_path: inputPath,
      layout,
      stacked_config:
        layout === "stacked"
          ? {
              top_crop: stackedConfig.top_crop,
              bottom_crop: stackedConfig.bottom_crop,
              split_ratio_top: stackedConfig.split_ratio_top,
            }
          : null,
    };
  }

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
          setSelectedTwitchClip(parsedPayload.clips[0]);
          setSourceMode("twitch_clips");
        }
      } catch (error) {
        console.error("Failed to parse OAuth payload:", error);
        setRequestError(
          "OAuth succeeded, but the returned payload could not be read."
        );
        setOauthStatus("error");
      }
    }

    if (oauth === "error") {
      setOauthStatus("error");
      setRequestError(errorMessage ?? "Twitch OAuth failed.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!dragState || !previewContainerRef.current) return;

      const scaleX = videoNaturalSize.width / videoDisplaySize.width;
      const scaleY = videoNaturalSize.height / videoDisplaySize.height;

      const deltaX = (event.clientX - dragState.startClientX) * scaleX;
      const deltaY = (event.clientY - dragState.startClientY) * scaleY;

      setCropDraft((current) => {
        const box = current[dragState.target];
        let nextBox: CropBox = { ...dragState.startBox };

        if (dragState.mode === "move") {
          nextBox.x = clamp(
            dragState.startBox.x + deltaX,
            0,
            videoNaturalSize.width - dragState.startBox.w
          );
          nextBox.y = clamp(
            dragState.startBox.y + deltaY,
            0,
            videoNaturalSize.height - dragState.startBox.h
          );
        } else {
          const minSize = 40;
          nextBox.w = clamp(
            dragState.startBox.w + deltaX,
            minSize,
            videoNaturalSize.width - dragState.startBox.x
          );
          nextBox.h = clamp(
            dragState.startBox.h + deltaY,
            minSize,
            videoNaturalSize.height - dragState.startBox.y
          );
        }

        return {
          ...current,
          [dragState.target]: roundBox(nextBox),
        };
      });
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, videoDisplaySize, videoNaturalSize]);

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
      if (layout === "stacked" && !stackedConfigIsValid) {
        throw new Error(
          "Crop boxes must use non-negative x/y values and positive width/height values."
        );
      }

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
      } else if (sourceMode === "twitch_clips") {
        if (!selectedTwitchClip?.url) {
          throw new Error("Please select a Twitch clip first.");
        }

        const response = await fetch(`${API_BASE_URL}/jobs/download-clip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clip_url: selectedTwitchClip.url,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create Twitch clip download job (${response.status}): ${errorText}`
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
          body: JSON.stringify(buildProcessRequestBody(selectedDownloadedPath)),
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

  function handleSelectTwitchClip(clip: TwitchClip) {
    setSelectedTwitchClip(clip);
    setSourceMode("twitch_clips");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleUseClipAsUrl(clip: TwitchClip) {
    setClipUrl(clip.url);
    setSourceMode("twitch_url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogoutTwitch() {
    setTwitchUser(null);
    setTwitchClips([]);
    setSelectedTwitchClip(null);
    setOauthStatus(null);

    if (sourceMode === "twitch_clips") {
      setSourceMode("twitch_url");
    }
  }

  function openCropEditor() {
    if (!cropEditorPreviewUrl) {
      setRequestError(
        "Visual crop editor currently requires a locally downloaded video. Use Downloaded File mode."
      );
      return;
    }

    setCropDraft({
      top_crop: { ...stackedConfig.top_crop },
      bottom_crop: { ...stackedConfig.bottom_crop },
      split_ratio_top: stackedConfig.split_ratio_top,
    });
    setIsCropEditorOpen(true);
  }

  function closeCropEditor() {
    setIsCropEditorOpen(false);
    setDragState(null);
  }

  function saveCropEditor() {
    setStackedConfig({
      top_crop: roundBox(cropDraft.top_crop),
      bottom_crop: roundBox(cropDraft.bottom_crop),
      split_ratio_top: cropDraft.split_ratio_top,
    });
    setIsCropEditorOpen(false);
    setDragState(null);
  }

  function startDrag(
    event: ReactPointerEvent,
    target: DragTarget,
    mode: DragMode
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragState({
      target,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: { ...cropDraft[target] },
    });
  }

  function updateSplitRatio(value: number) {
    setCropDraft((current) => ({
      ...current,
      split_ratio_top: clamp(value, 0.2, 0.8),
    }));
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

    const inputPath = downloadedPath;

    async function startProcessJob() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildProcessRequestBody(inputPath)),
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
  }, [downloadedPath, layout, processJobId, stackedConfig]);

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

  const submitButtonLabel =
    isSubmitting
      ? "Submitting..."
      : sourceMode === "twitch_clips"
      ? "Download Selected Clip and Process"
      : sourceMode === "twitch_url"
      ? "Download and Process URL"
      : "Process Downloaded File";

  const statusTone =
    overallStatus === "completed"
      ? "text-green-400"
      : overallStatus === "failed"
      ? "text-red-400"
      : overallStatus === "processing" || overallStatus === "queued"
      ? "text-amber-400"
      : "text-zinc-300";

  const topPreviewStyle = {
    left: `${(cropDraft.top_crop.x / videoNaturalSize.width) * videoDisplaySize.width}px`,
    top: `${(cropDraft.top_crop.y / videoNaturalSize.height) * videoDisplaySize.height}px`,
    width: `${(cropDraft.top_crop.w / videoNaturalSize.width) * videoDisplaySize.width}px`,
    height: `${(cropDraft.top_crop.h / videoNaturalSize.height) * videoDisplaySize.height}px`,
  };

  const bottomPreviewStyle = {
    left: `${(cropDraft.bottom_crop.x / videoNaturalSize.width) * videoDisplaySize.width}px`,
    top: `${(cropDraft.bottom_crop.y / videoNaturalSize.height) * videoDisplaySize.height}px`,
    width: `${(cropDraft.bottom_crop.w / videoNaturalSize.width) * videoDisplaySize.width}px`,
    height: `${(cropDraft.bottom_crop.h / videoNaturalSize.height) * videoDisplaySize.height}px`,
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-violet-400">
                Dissertation Project
              </p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                AI-Assisted Twitch Clip Editing
              </h1>
              <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
                Turn Twitch clips into vertical short-form videos using authenticated
                Twitch clips, pasted clip URLs, or already-downloaded local test files.
              </p>
            </div>

            <div className="w-full xl:max-w-sm">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      Twitch Account
                    </p>
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
                    onClick={handleLoginWithTwitch}
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
                          {twitchClips.length}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogoutTwitch}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Clear Twitch Session
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div>
                <h2 className="text-xl font-semibold">Editor Controls</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Choose a source, pick a layout, and start the render pipeline.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setSourceMode("twitch_clips")}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    sourceMode === "twitch_clips"
                      ? "bg-violet-500 text-white"
                      : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  Twitch Clips
                </button>

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
                {sourceMode === "twitch_clips" ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Selected Clip
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          Process a clip directly from your authenticated Twitch list.
                        </p>
                      </div>

                      {selectedTwitchClip ? (
                        <span className="rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Ready
                        </span>
                      ) : null}
                    </div>

                    {!twitchUser ? (
                      <p className="mt-4 text-sm text-zinc-500">
                        Log in with Twitch to use this source mode.
                      </p>
                    ) : !selectedTwitchClip ? (
                      <p className="mt-4 text-sm text-zinc-500">
                        Choose one from the clips grid to continue.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {selectedTwitchClip.thumbnail_url ? (
                          <img
                            src={selectedTwitchClip.thumbnail_url}
                            alt={selectedTwitchClip.title ?? "Selected Twitch clip"}
                            className="h-36 w-full rounded-xl border border-zinc-800 object-cover"
                          />
                        ) : null}

                        <div>
                          <p className="text-sm font-medium text-zinc-100">
                            {selectedTwitchClip.title || "Untitled clip"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                            <span>
                              Creator: {selectedTwitchClip.creator_name ?? "Unknown"}
                            </span>
                            <span>•</span>
                            <span>Views: {selectedTwitchClip.view_count ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : sourceMode === "twitch_url" ? (
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
                    <p className="mt-2 text-xs text-zinc-500">
                      Use this mode for manual testing or direct pasted URLs.
                    </p>
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
                    <p className="mt-2 text-xs text-zinc-500">
                      Useful for quick local render tests without redownloading clips.
                    </p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="layout"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Layout preset
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

                {layout === "stacked" && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">
                            Visual Stacked Crop Editor
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            Final export stays fixed at 1080×1920. This editor only
                            chooses the source crop areas for the top and bottom stack.
                          </p>
                        </div>
                      </div>

                      {sourceMode === "downloaded_file" ? (
                        <button
                          type="button"
                          onClick={openCropEditor}
                          disabled={!selectedDownloadedPath}
                          className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Open Visual Crop Editor
                        </button>
                      ) : (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
                          Visual crop preview currently works with locally downloaded video
                          files. Use Downloaded File mode for the popup editor. We can add
                          auto-download-then-open for Twitch clips next.
                        </div>
                      )}

                      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Top / Bottom split</span>
                          <span className="font-semibold text-zinc-100">
                            {Math.round(stackedConfig.split_ratio_top * 100)}% /{" "}
                            {100 - Math.round(stackedConfig.split_ratio_top * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (sourceMode === "twitch_clips" && !selectedTwitchClip) ||
                    (sourceMode === "downloaded_file" && !selectedDownloadedPath) ||
                    (layout === "stacked" && !stackedConfigIsValid)
                  }
                  className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitButtonLabel}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Job Activity</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Compact pipeline status for the current run.
                  </p>
                </div>

                <span className={`text-sm font-semibold ${statusTone}`}>
                  {overallStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Selected source
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">{sourceMode}</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Layout
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">{layout}</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Download job
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-100">
                    {downloadJobId ?? "Not started"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Process job
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-100">
                    {processJobId ?? "Not started"}
                  </p>
                </div>

                {requestError && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {requestError}
                  </div>
                )}

                {downloadJobStatus?.error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Download error: {downloadJobStatus.error}
                  </div>
                )}

                {processJobStatus?.error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Process error: {processJobStatus.error}
                  </div>
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Your Twitch Clips</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Select a clip as your source, send it into manual URL mode, or
                    open it on Twitch.
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
                    No Twitch account connected yet. Use the login button above to
                    load recent clips.
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
                                onClick={() => handleSelectTwitchClip(clip)}
                                className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400"
                              >
                                Select
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUseClipAsUrl(clip)}
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

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Output Preview</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Once processing completes, the rendered vertical video appears here.
                  </p>
                </div>

                {processJobStatus?.result ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    {(processJobStatus.result as ProcessJobResult).layout ?? "N/A"} layout
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex min-h-[700px] items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
                {outputVideoUrl ? (
                  <video
                    key={outputVideoUrl}
                    controls
                    className="max-h-[660px] rounded-2xl border border-zinc-800 shadow-2xl"
                    src={outputVideoUrl}
                  />
                ) : (
                  <div className="text-center text-sm text-zinc-500">
                    No processed video yet. Start a job to preview the result.
                  </div>
                )}
              </div>

              {processJobStatus?.result && (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Filename
                    </p>
                    <p className="mt-2 break-all">
                      {(processJobStatus.result as ProcessJobResult).filename ??
                        "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Layout
                    </p>
                    <p className="mt-2">
                      {(processJobStatus.result as ProcessJobResult).layout ?? "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Output URL
                    </p>
                    <p className="mt-2 break-all">
                      {(processJobStatus.result as ProcessJobResult).output_url ??
                        "N/A"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {isCropEditorOpen && cropEditorPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Visual Stacked Crop Editor
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Drag the colored crop boxes over the source video. Final export remains fixed at 1080×1920.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCropEditor}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCropEditor}
                  className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
                >
                  Save crop
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-h-0 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div
                  ref={previewContainerRef}
                  className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-700 bg-black"
                >
                  <video
                    ref={videoRef}
                    src={cropEditorPreviewUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    className="block h-auto w-full"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      setVideoNaturalSize({
                        width: video.videoWidth,
                        height: video.videoHeight,
                      });
                      setVideoDisplaySize({
                        width: video.clientWidth,
                        height: video.clientHeight,
                      });
                    }}
                    onLoadedData={(event) => {
                      const video = event.currentTarget;
                      setVideoDisplaySize({
                        width: video.clientWidth,
                        height: video.clientHeight,
                      });
                    }}
                  />

                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className="pointer-events-auto absolute border-2 border-violet-400 bg-violet-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]"
                      style={topPreviewStyle}
                      onPointerDown={(event) => startDrag(event, "top_crop", "move")}
                    >
                      <div className="absolute left-2 top-2 rounded-md bg-violet-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Top / facecam
                      </div>
                      <div
                        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl-md bg-violet-400"
                        onPointerDown={(event) => startDrag(event, "top_crop", "resize")}
                      />
                    </div>

                    <div
                      className="pointer-events-auto absolute border-2 border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.08)]"
                      style={bottomPreviewStyle}
                      onPointerDown={(event) => startDrag(event, "bottom_crop", "move")}
                    >
                      <div className="absolute left-2 top-2 rounded-md bg-cyan-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Bottom / gameplay
                      </div>
                      <div
                        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl-md bg-cyan-400"
                        onPointerDown={(event) => startDrag(event, "bottom_crop", "resize")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 overflow-auto">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Stack split
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Controls the fixed 1080×1920 output split between the top and bottom stacked regions.
                  </p>

                  <div className="mt-4">
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={Math.round(cropDraft.split_ratio_top * 100)}
                      onChange={(event) =>
                        updateSplitRatio(Number(event.target.value) / 100)
                      }
                      className="w-full"
                    />
                    <div className="mt-2 flex items-center justify-between text-sm text-zinc-300">
                      <span>Top: {Math.round(cropDraft.split_ratio_top * 100)}%</span>
                      <span>
                        Bottom: {100 - Math.round(cropDraft.split_ratio_top * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Top crop</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">x</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.top_crop.x}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">y</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.top_crop.y}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">w</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.top_crop.w}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">h</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.top_crop.h}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Bottom crop</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">x</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.x}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">y</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.y}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">w</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.w}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">h</p>
                      <p className="mt-1 text-zinc-100">{cropDraft.bottom_crop.h}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-6 text-zinc-400">
                  Purple crop fills the top stacked region.
                  <br />
                  Cyan crop fills the bottom stacked region.
                  <br />
                  Each crop is scaled to fit its destination while preserving aspect ratio.
                  <br />
                  No stretching is applied.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}