"use client";

import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AccountPanel } from "./components/AccountPanel";
import { CropEditorModal } from "./components/CropEditorModal";
import { DownloadedFilesPanel } from "./components/DownloadedFilesPanel";
import { EditorControlsPanel } from "./components/EditorControlsPanel";
import { JobActivityPanel } from "./components/JobActivityPanel";
import { OutputPreviewPanel } from "./components/OutputPreviewPanel";
import { TwitchClipsPanel } from "./components/TwitchClipsPanel";
import { TwitchUrlPanel } from "./components/TwitchUrlPanel";
import type {
  CropBox,
  DownloadJobResult,
  DownloadedClip,
  DownloadedClipsResponse,
  DragMode,
  DragState,
  DragTarget,
  JobCreateResponse,
  JobStatusResponse,
  LayoutOption,
  OAuthPayload,
  PipelineStage,
  ProcessJobResult,
  SourceMode,
  StackedConfig,
  TwitchClip,
  TwitchUser,
} from "./types";
import { clamp, roundBox } from "./utils";

const API_BASE_URL = "http://localhost:8000";

const DEFAULT_STACKED_CONFIG: StackedConfig = {
  top_crop: { x: 1340, y: 40, w: 520, h: 520 },
  bottom_crop: { x: 420, y: 0, w: 1080, h: 1080 },
  split_ratio_top: 0.4,
};

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
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [pipelineMessage, setPipelineMessage] = useState<string>("Ready.");
  const [twitchUser, setTwitchUser] = useState<TwitchUser | null>(null);
  const [twitchClips, setTwitchClips] = useState<TwitchClip[]>([]);
  const [selectedTwitchClip, setSelectedTwitchClip] =
    useState<TwitchClip | null>(null);
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [cropDraft, setCropDraft] = useState<StackedConfig>(DEFAULT_STACKED_CONFIG);
  const [videoNaturalSize, setVideoNaturalSize] = useState({
    width: 1920,
    height: 1080,
  });
  const [videoDisplaySize, setVideoDisplaySize] = useState({
    width: 1,
    height: 1,
  });
  const [dragState, setDragState] = useState<DragState>(null);
  const [cropEditorPreviewUrlOverride, setCropEditorPreviewUrlOverride] =
    useState<string | null>(null);
  const [pendingCropProcessPath, setPendingCropProcessPath] =
    useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const outputPreviewRef = useRef<HTMLDivElement | null>(null);
  const previousPipelineStageRef = useRef<PipelineStage>("idle");
  const submittedLayoutRef = useRef<LayoutOption>(layout);
  const submittedSourceModeRef = useRef<SourceMode>(sourceMode);

  const outputVideoUrl = useMemo(() => {
    const result = processJobStatus?.result as ProcessJobResult | null;
    const outputUrl = result?.output_url;

    if (!outputUrl) return null;
    return `${API_BASE_URL}${outputUrl}`;
  }, [processJobStatus]);

  const selectedDownloadedClip = useMemo(() => {
    return (
      downloadedClips.find((clip) => clip.download_path === selectedDownloadedPath) ??
      null
    );
  }, [downloadedClips, selectedDownloadedPath]);

  function getDownloadedClipUrl(clip: DownloadedClip) {
    return `${API_BASE_URL}${clip.url}`;
  }

  const cropEditorPreviewUrl = useMemo(() => {
    if (cropEditorPreviewUrlOverride) {
      return cropEditorPreviewUrlOverride;
    }

    if (!selectedDownloadedClip) return null;
    return `${API_BASE_URL}${selectedDownloadedClip.url}`;
  }, [cropEditorPreviewUrlOverride, selectedDownloadedClip]);

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

  async function fetchDownloadedClips(preferredPath?: string) {
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

      if (preferredPath) {
        const matchingClip = data.clips.find(
          (clip) => clip.download_path === preferredPath
        );

        if (matchingClip) {
          setSelectedDownloadedPath(matchingClip.download_path);
          return;
        }
      }

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

  useEffect(() => {
    void fetchDownloadedClips();
  }, []);

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
        const nextBox: CropBox = { ...dragState.startBox };

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
    setPipelineStage("submitting");
    setPipelineMessage("Preparing pipeline...");
    submittedLayoutRef.current = layout;
    submittedSourceModeRef.current = sourceMode;

    setDownloadJobId(null);
    setDownloadJobStatus(null);
    setDownloadedPath(null);
    setProcessJobId(null);
    setProcessJobStatus(null);
    setCropEditorPreviewUrlOverride(null);
    setPendingCropProcessPath(null);
    setIsCropEditorOpen(false);

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
        setPipelineStage("downloading");
        setPipelineMessage("Downloading Twitch clip...");
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
        setPipelineStage("downloading");
        setPipelineMessage("Downloading selected Twitch clip...");
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
        setPipelineStage("processing");
        setPipelineMessage("Processing downloaded file...");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";
      setRequestError(message);
      setPipelineStage("failed");
      setPipelineMessage("Pipeline failed before processing could start.");
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

  function handleSelectDownloadedClip(clip: DownloadedClip) {
    setSelectedDownloadedPath(clip.download_path);
    setSourceMode("downloaded_file");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenDownloadedClip(clip: DownloadedClip) {
    window.open(getDownloadedClipUrl(clip), "_blank", "noopener,noreferrer");
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

  function openCropEditor(previewUrl?: string, processPathAfterSave?: string) {
    const resolvedPreviewUrl = previewUrl ?? cropEditorPreviewUrl;

    if (!resolvedPreviewUrl) {
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

    setCropEditorPreviewUrlOverride(previewUrl ?? null);
    setPendingCropProcessPath(processPathAfterSave ?? null);
    setIsCropEditorOpen(true);
  }

  function closeCropEditor() {
    setIsCropEditorOpen(false);
    setDragState(null);
    setCropEditorPreviewUrlOverride(null);
    setPendingCropProcessPath(null);
    setPipelineStage("idle");
    setPipelineMessage("Crop editor closed. Submit again when ready.");
  }

  function saveCropEditor() {
    setStackedConfig({
      top_crop: roundBox(cropDraft.top_crop),
      bottom_crop: roundBox(cropDraft.bottom_crop),
      split_ratio_top: cropDraft.split_ratio_top,
    });

    setIsCropEditorOpen(false);
    setDragState(null);
    setCropEditorPreviewUrlOverride(null);

    if (pendingCropProcessPath) {
      setPipelineStage("processing");
      setPipelineMessage("Crop confirmed — starting stacked render...");
      setDownloadedPath(pendingCropProcessPath);
      setPendingCropProcessPath(null);
      return;
    }

    setPipelineStage("idle");
    setPipelineMessage("Crop updated.");
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

        if (data.status === "queued") {
          setPipelineStage("downloading");
          setPipelineMessage("Download job queued...");
        }

        if (data.status === "processing") {
          setPipelineStage("downloading");
          setPipelineMessage("Downloading Twitch clip...");
        }

        if (data.status === "completed") {
          const result = data.result as DownloadJobResult | null;
          const path = result?.download_path;
          const filename = result?.filename;

          if (!path) {
            setRequestError(
              "Download job completed but no download_path was returned."
            );
            clearInterval(intervalId);
            return;
          }

          await fetchDownloadedClips(path);
          setPipelineStage("download_complete");
          setPipelineMessage("Download complete.");

          const previewUrl = result?.download_url
            ? `${API_BASE_URL}${result.download_url}`
            : filename
            ? `${API_BASE_URL}/storage/downloads/${encodeURIComponent(filename)}`
            : null;

          const submittedLayout = submittedLayoutRef.current;
          const submittedSourceMode = submittedSourceModeRef.current;

          if (
            submittedLayout === "stacked" &&
            submittedSourceMode !== "downloaded_file"
          ) {
            setSelectedDownloadedPath(path);
            setPipelineStage("awaiting_crop");
            setPipelineMessage("Download complete — waiting for crop confirmation.");
            openCropEditor(previewUrl ?? undefined, path);
            clearInterval(intervalId);
            setDownloadJobId(null);
            return;
          }

          setPipelineStage("processing");
          setPipelineMessage("Download complete — starting render...");
          setDownloadedPath(path);
          clearInterval(intervalId);
          setDownloadJobId(null);
          return;
        }

        if (data.status === "failed") {
          setPipelineStage("failed");
          setPipelineMessage("Clip download failed.");
          clearInterval(intervalId);
          setDownloadJobId(null);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown download polling error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Download polling failed.");
        clearInterval(intervalId);
      }
    }

    const intervalId = setInterval(() => {
      void fetchDownloadJobStatus();
    }, 2000);
    void fetchDownloadJobStatus();

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

    void startProcessJob();
  }, [downloadedPath, layout, processJobId, stackedConfig]);

  useEffect(() => {
    if (!processJobId) return;

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

        if (data.status === "queued") {
          setPipelineStage("processing");
          setPipelineMessage("Render job queued...");
        }

        if (data.status === "processing") {
          setPipelineStage("processing");
          setPipelineMessage("Rendering vertical video...");
        }

        if (data.status === "completed") {
          setPipelineStage("completed");
          setPipelineMessage("Render complete.");
          clearInterval(intervalId);
        }

        if (data.status === "failed") {
          setPipelineStage("failed");
          setPipelineMessage("Render failed.");
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process polling error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Process polling failed.");
        clearInterval(intervalId);
      }
    }

    const intervalId = setInterval(fetchProcessJobStatus, 2000);
    void fetchProcessJobStatus();

    return () => clearInterval(intervalId);
  }, [processJobId]);

  useEffect(() => {
    if (
      pipelineStage === "processing" &&
      previousPipelineStageRef.current !== "processing"
    ) {
      outputPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    previousPipelineStageRef.current = pipelineStage;
  }, [pipelineStage]);

  const overallStatus = pipelineStage;

  const submitButtonLabel =
    pipelineStage === "submitting"
      ? "Submitting..."
      : pipelineStage === "downloading"
      ? "Downloading..."
      : pipelineStage === "awaiting_crop"
      ? "Waiting for crop..."
      : pipelineStage === "processing"
      ? "Processing..."
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
      : overallStatus === "submitting" ||
        overallStatus === "downloading" ||
        overallStatus === "download_complete" ||
        overallStatus === "awaiting_crop" ||
        overallStatus === "processing"
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-8 sm:px-6 lg:px-8">
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
              <AccountPanel
                oauthStatus={oauthStatus}
                twitchClipsCount={twitchClips.length}
                twitchUser={twitchUser}
                onLoginWithTwitch={handleLoginWithTwitch}
                onLogoutTwitch={handleLogoutTwitch}
              />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <EditorControlsPanel
              clipUrl={clipUrl}
              isSubmitting={isSubmitting}
              layout={layout}
              selectedDownloadedPath={selectedDownloadedPath}
              selectedTwitchClip={selectedTwitchClip}
              sourceMode={sourceMode}
              stackedConfig={stackedConfig}
              stackedConfigIsValid={stackedConfigIsValid}
              submitButtonLabel={submitButtonLabel}
              twitchUser={twitchUser}
              onClipUrlChange={setClipUrl}
              onLayoutChange={setLayout}
              onOpenCropEditor={() => openCropEditor()}
              onSourceModeChange={setSourceMode}
              onSubmit={handleSubmit}
            />

            <JobActivityPanel
              downloadJobId={downloadJobId}
              downloadJobStatus={downloadJobStatus}
              layout={layout}
              overallStatus={overallStatus}
              pipelineMessage={pipelineMessage}
              pipelineStage={pipelineStage}
              processJobId={processJobId}
              processJobStatus={processJobStatus}
              requestError={requestError}
              sourceMode={sourceMode}
              statusTone={statusTone}
            />
          </aside>

          <section className="space-y-6">
            {sourceMode === "twitch_clips" ? (
              <TwitchClipsPanel
                selectedTwitchClip={selectedTwitchClip}
                twitchClips={twitchClips}
                twitchUser={twitchUser}
                onSelectTwitchClip={handleSelectTwitchClip}
                onUseClipAsUrl={handleUseClipAsUrl}
              />
            ) : sourceMode === "twitch_url" ? (
              <TwitchUrlPanel
                clipUrl={clipUrl}
                onClipUrlChange={setClipUrl}
              />
            ) : (
              <DownloadedFilesPanel
                downloadedClips={downloadedClips}
                getDownloadedClipUrl={getDownloadedClipUrl}
                layout={layout}
                selectedDownloadedClip={selectedDownloadedClip}
                selectedDownloadedPath={selectedDownloadedPath}
                onOpenCropEditor={() => openCropEditor()}
                onOpenDownloadedClip={handleOpenDownloadedClip}
                onSelectDownloadedClip={handleSelectDownloadedClip}
              />
            )}

            <OutputPreviewPanel
              outputVideoUrl={outputVideoUrl}
              pipelineMessage={pipelineMessage}
              pipelineStage={pipelineStage}
              processJobStatus={processJobStatus}
              sectionRef={outputPreviewRef}
              statusTone={statusTone}
            />
          </section>
        </div>
      </div>

      <CropEditorModal
        bottomPreviewStyle={bottomPreviewStyle}
        cropDraft={cropDraft}
        cropEditorPreviewUrl={cropEditorPreviewUrl}
        isOpen={isCropEditorOpen}
        onClose={closeCropEditor}
        onLoadedData={(video) => {
          setVideoDisplaySize({
            width: video.clientWidth,
            height: video.clientHeight,
          });
        }}
        onLoadedMetadata={(video) => {
          setVideoNaturalSize({
            width: video.videoWidth,
            height: video.videoHeight,
          });
          setVideoDisplaySize({
            width: video.clientWidth,
            height: video.clientHeight,
          });
        }}
        onSave={saveCropEditor}
        onStartDrag={startDrag}
        onUpdateSplitRatio={updateSplitRatio}
        previewContainerRef={previewContainerRef}
        topPreviewStyle={topPreviewStyle}
        videoRef={videoRef}
      />
    </main>
  );
}
