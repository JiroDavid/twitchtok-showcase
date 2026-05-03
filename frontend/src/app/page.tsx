"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AccountPanel } from "./components/AccountPanel";
import { ConfigureHighlightModal } from "./components/ConfigureHighlightModal";
import { CropEditorModal } from "./components/CropEditorModal";
import { DownloadedFilesPanel } from "./components/DownloadedFilesPanel";
import { EditorControlsPanel } from "./components/EditorControlsPanel";
import { JobActivityPanel } from "./components/JobActivityPanel";
import { OutputPreviewPanel } from "./components/OutputPreviewPanel";
import { SubtitleEditorModal } from "./components/SubtitleEditorModal";
import { TwitchClipsPanel } from "./components/TwitchClipsPanel";
import { TwitchUrlPanel } from "./components/TwitchUrlPanel";
import type {
  CropBox,
  CropRerenderJobResult,
  DownloadJobResult,
  DownloadedClip,
  DownloadedClipsResponse,
  DragMode,
  DragState,
  DragTarget,
  EditableCaptionDraft,
  HighlightConfig,
  HighlightFontOption,
  JobCreateResponse,
  JobStatusResponse,
  LayoutAnalysisJobResult,
  LayoutOption,
  MetadataJsonCaptionsEntry,
  OAuthPayload,
  PipelineStage,
  ProcessJobResult,
  SourceMode,
  StackedConfig,
  SubtitleRerenderJobResult,
  TwitchClip,
  TwitchUser,
  UiMode,
} from "./types";
import { clamp, roundBox } from "./utils";

const API_BASE_URL = "";

const DEFAULT_STACKED_CONFIG: StackedConfig = {
  top_crop: { x: 1340, y: 40, w: 520, h: 520 },
  bottom_crop: { x: 420, y: 0, w: 1080, h: 1080 },
  split_ratio_top: 0.4,
};

const DEFAULT_SUBTITLE_STYLE = {
  color: "#FFFFFF",
  font_family: "Arial" as HighlightFontOption,
  font_size: 140,
  outline: 8,
  shadow: 3,
};

const DEFAULT_SUBTITLE_PLACEMENT = {
  track: "bottom" as const,
  x: null,
  y: null,
  align: "bottom" as const,
};

const DEFAULT_HIGHLIGHT_CONFIG: HighlightConfig = {
  layout: "cropped",
  subtitle_style: { ...DEFAULT_SUBTITLE_STYLE },
  censor_subtitles: false,
};


function sanitizeCaptionDraft(caption: EditableCaptionDraft): EditableCaptionDraft {
  const start = Number.isFinite(caption.start) ? Math.max(0, caption.start) : 0;
  const end = Number.isFinite(caption.end) ? Math.max(start, caption.end) : start;

  return {
    ...caption,
    start,
    end,
    final_text: caption.final_text.trim(),
    style: {
      color: caption.style.color || DEFAULT_SUBTITLE_STYLE.color,
      font_family: caption.style.font_family || DEFAULT_SUBTITLE_STYLE.font_family,
      font_size:
        Number.isFinite(caption.style.font_size) && caption.style.font_size > 0
          ? caption.style.font_size
          : DEFAULT_SUBTITLE_STYLE.font_size,
      outline:
        Number.isFinite(caption.style.outline) && caption.style.outline >= 0
          ? caption.style.outline
          : DEFAULT_SUBTITLE_STYLE.outline,
      shadow:
        Number.isFinite(caption.style.shadow) && caption.style.shadow >= 0
          ? caption.style.shadow
          : DEFAULT_SUBTITLE_STYLE.shadow,
    },
    placement: {
      track: caption.placement.track ?? DEFAULT_SUBTITLE_PLACEMENT.track,
      x:
        typeof caption.placement.x === "number" &&
        Number.isFinite(caption.placement.x)
          ? caption.placement.x
          : null,
      y:
        typeof caption.placement.y === "number" &&
        Number.isFinite(caption.placement.y)
          ? caption.placement.y
          : null,
      align: caption.placement.align ?? DEFAULT_SUBTITLE_PLACEMENT.align,
    },
  };
}

function toEditableCaptionDraft(
  caption: MetadataJsonCaptionsEntry,
  index: number
): EditableCaptionDraft {
  return {
    id: typeof caption.id === "number" ? caption.id : index + 1,
    start: typeof caption.start === "number" ? caption.start : 0,
    end: typeof caption.end === "number" ? caption.end : 0,
    raw_text: caption.raw_text ?? "",
    refined_text: caption.refined_text ?? "",
    final_text:
      caption.final_text?.trim() ||
      caption.refined_text?.trim() ||
      caption.raw_text?.trim() ||
      "",
    status: caption.status ?? "draft",
    is_manual: Boolean(caption.is_manual),
    style: {
      color: caption.style?.color ?? DEFAULT_SUBTITLE_STYLE.color,
      font_family:
        caption.style?.font_family ?? DEFAULT_SUBTITLE_STYLE.font_family,
      font_size: caption.style?.font_size ?? DEFAULT_SUBTITLE_STYLE.font_size,
      outline: caption.style?.outline ?? DEFAULT_SUBTITLE_STYLE.outline,
      shadow: caption.style?.shadow ?? DEFAULT_SUBTITLE_STYLE.shadow,
    },
    placement: {
      track: caption.placement?.track ?? DEFAULT_SUBTITLE_PLACEMENT.track,
      x: caption.placement?.x ?? DEFAULT_SUBTITLE_PLACEMENT.x,
      y: caption.placement?.y ?? DEFAULT_SUBTITLE_PLACEMENT.y,
      align: caption.placement?.align ?? DEFAULT_SUBTITLE_PLACEMENT.align,
    },
  };
}

function createNewCaptionDraft(
  existingDrafts: EditableCaptionDraft[],
  baseStyle: HighlightConfig["subtitle_style"]
): EditableCaptionDraft {
  const nextId =
    existingDrafts.length > 0
      ? Math.max(...existingDrafts.map((item) => item.id)) + 1
      : 1;

  return {
    id: nextId,
    start: 0,
    end: 2,
    raw_text: "",
    refined_text: "",
    final_text: "",
    status: "draft",
    is_manual: true,
    style: { ...baseStyle },
    placement: { ...DEFAULT_SUBTITLE_PLACEMENT },
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
  const [subtitleRerenderJobId, setSubtitleRerenderJobId] = useState<
    string | null
  >(null);
  const [subtitleRerenderJobStatus, setSubtitleRerenderJobStatus] =
    useState<JobStatusResponse | null>(null);
  const [isApplyingSubtitleEdits, setIsApplyingSubtitleEdits] = useState(false);
  const [processingDurationMs, setProcessingDurationMs] = useState<number | null>(null);
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
  const [cropDraft, setCropDraft] =
    useState<StackedConfig>(DEFAULT_STACKED_CONFIG);
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
  const [pendingCropProcessPath, setPendingCropProcessPath] = useState<
    string | null
  >(null);
  const [cropEditorRequiresConfirmation, setCropEditorRequiresConfirmation] =
    useState(false);

  const [isSubtitleEditorOpen, setIsSubtitleEditorOpen] = useState(false);
  const [subtitleDrafts, setSubtitleDrafts] = useState<EditableCaptionDraft[]>(
    []
  );
  const [savedSubtitleDrafts, setSavedSubtitleDrafts] = useState<
    EditableCaptionDraft[]
  >([]);

  const [highlightConfig, setHighlightConfig] = useState<HighlightConfig>({
    ...DEFAULT_HIGHLIGHT_CONFIG,
  });
  const [highlightConfigDraft, setHighlightConfigDraft] =
    useState<HighlightConfig>({
      ...DEFAULT_HIGHLIGHT_CONFIG,
    });
  const [isConfigureHighlightOpen, setIsConfigureHighlightOpen] = useState(false);

  const [uiMode, setUiMode] = useState<UiMode>("non_ai");
  const [hideModeBadge, setHideModeBadge] = useState(false);
  const [uiModeLocked, setUiModeLocked] = useState(false);

  const [layoutAnalysisJobId, setLayoutAnalysisJobId] = useState<string | null>(null);
  const [layoutAnalysisJobStatus, setLayoutAnalysisJobStatus] =
    useState<JobStatusResponse | null>(null);
  const [pendingAnalysisProcessPath, setPendingAnalysisProcessPath] = useState<
    string | null
  >(null);
  const [aiCropStatus, setAiCropStatus] = useState<"success" | "failed" | null>(null);
  const [aiCropReasoning, setAiCropReasoning] = useState<string | null>(null);

  const [cropRerenderJobId, setCropRerenderJobId] = useState<string | null>(null);
  const [cropRerenderJobStatus, setCropRerenderJobStatus] =
    useState<JobStatusResponse | null>(null);
  const [isPostRenderCropMode, setIsPostRenderCropMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const outputPreviewRef = useRef<HTMLDivElement | null>(null);
  const previousPipelineStageRef = useRef<PipelineStage>("idle");
  const submittedLayoutRef = useRef<LayoutOption>(layout);
  const submittedSourceModeRef = useRef<SourceMode>(sourceMode);
  const submittedHighlightConfigRef = useRef<HighlightConfig>({
    ...DEFAULT_HIGHLIGHT_CONFIG,
  });
  const cropSourceRef = useRef<"ai" | "manual">("manual");
  const processStartedAtRef = useRef<number | null>(null);

  const processResult = useMemo(() => {
    return processJobStatus?.result as ProcessJobResult | null;
  }, [processJobStatus]);

  const subtitleRerenderResult = useMemo(() => {
    return subtitleRerenderJobStatus?.result as SubtitleRerenderJobResult | null;
  }, [subtitleRerenderJobStatus]);

  const activeOutputResult = useMemo(() => {
    return subtitleRerenderResult ?? processResult;
  }, [subtitleRerenderResult, processResult]);

  const outputVideoUrl = useMemo(() => {
    if (pipelineStage === "subtitle_rerender" || cropRerenderJobId !== null) {
      return null;
    }

    const outputUrl = activeOutputResult?.output_url;
    if (!outputUrl) return null;

    return `${API_BASE_URL}${outputUrl}?t=${encodeURIComponent(
      activeOutputResult?.filename ?? Date.now().toString()
    )}`;
  }, [activeOutputResult, cropRerenderJobId, pipelineStage]);

  const metadataPayload = useMemo(() => {
    return processResult?.metadata?.payload;
  }, [processResult]);

  const generatedCaptionItems = useMemo(() => {
    const rerenderItems = subtitleRerenderResult?.captions?.items ?? [];
    if (rerenderItems.length > 0) {
      return rerenderItems;
    }

    return metadataPayload?.captions?.items ?? [];
  }, [metadataPayload, subtitleRerenderResult]);

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

  function buildProcessRequestBody(inputPath: string, config: HighlightConfig) {
    const isAiMode = uiMode === "ai";
    return {
      input_path: inputPath,
      layout: config.layout,
      stacked_config:
        config.layout === "stacked"
          ? {
              top_crop: stackedConfig.top_crop,
              bottom_crop: stackedConfig.bottom_crop,
              split_ratio_top: stackedConfig.split_ratio_top,
            }
          : null,
      captions: isAiMode
        ? {
            enabled: true,
            burn_in: true,
            refine_with_llm: true,
            refinement_model: "llama3.1:8b",
            censor_subtitles: config.censor_subtitles,
            default_style: {
              color: config.subtitle_style.color,
              font_family: config.subtitle_style.font_family,
              font_size: config.subtitle_style.font_size,
              outline: config.subtitle_style.outline,
              shadow: config.subtitle_style.shadow,
            },
          }
        : { enabled: false },
      metadata: {
        enabled: isAiMode,
        vision_model: isAiMode ? "llava-llama3:8b" : null,
        metadata_model: isAiMode ? "llama3.1:8b" : null,
      },
      crop_source: cropSourceRef.current,
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

    const modeParam = params.get("mode");
    if (modeParam === "ai" || modeParam === "non_ai") {
      setUiMode(modeParam);
      setUiModeLocked(true);
    }

    if (params.get("hide_mode") === "true") {
      setHideModeBadge(true);
    }

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

  useEffect(() => {
    if (generatedCaptionItems.length === 0) return;

    const nextDrafts = generatedCaptionItems.map(toEditableCaptionDraft);
    setSubtitleDrafts(nextDrafts);
    setSavedSubtitleDrafts(nextDrafts);
  }, [generatedCaptionItems]);

  function openConfigureHighlight() {
    setHighlightConfigDraft({
      layout,
      subtitle_style: {
        ...highlightConfig.subtitle_style,
      },
      censor_subtitles: highlightConfig.censor_subtitles,
    });
    setIsConfigureHighlightOpen(true);
  }

  function closeConfigureHighlight() {
    if (isSubmitting) return;
    setIsConfigureHighlightOpen(false);
  }

  async function startConfiguredPipeline(config: HighlightConfig) {
    setIsSubmitting(true);
    setRequestError(null);
    setPipelineStage("submitting");
    setPipelineMessage("Preparing pipeline...");
    submittedLayoutRef.current = config.layout;
    submittedSourceModeRef.current = sourceMode;
    submittedHighlightConfigRef.current = config;
    setLayout(config.layout);
    setHighlightConfig(config);

    setDownloadJobId(null);
    setDownloadJobStatus(null);
    setDownloadedPath(null);
    setProcessJobId(null);
    setProcessJobStatus(null);
    setSubtitleRerenderJobId(null);
    setSubtitleRerenderJobStatus(null);
    setCropEditorPreviewUrlOverride(null);
    setPendingCropProcessPath(null);
    setIsCropEditorOpen(false);
    setIsSubtitleEditorOpen(false);
    setLayoutAnalysisJobId(null);
    setLayoutAnalysisJobStatus(null);
    setPendingAnalysisProcessPath(null);
    setAiCropStatus(null);
    setAiCropReasoning(null);
    cropSourceRef.current = "manual";
    processStartedAtRef.current = null;
    setProcessingDurationMs(null);
    setCropRerenderJobId(null);
    setCropRerenderJobStatus(null);
    setIsPostRenderCropMode(false);

    try {
      if (config.layout === "stacked" && !stackedConfigIsValid) {
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

        if (config.layout === "stacked") {
          if (uiMode === "ai") {
            setPipelineStage("analyzing_layout");
            setPipelineMessage("Analysing stacked crop regions with AI...");
            setPendingAnalysisProcessPath(selectedDownloadedPath);

            const analysisResponse = await fetch(
              `${API_BASE_URL}/jobs/analyze-layout`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  input_path: selectedDownloadedPath,
                  vision_model: null,
                }),
              }
            );

            if (!analysisResponse.ok) {
              const errorText = await analysisResponse.text();
              throw new Error(
                `Layout analysis job failed to start (${analysisResponse.status}): ${errorText}`
              );
            }

            const analysisData: JobCreateResponse = await analysisResponse.json();
            setLayoutAnalysisJobId(analysisData.job_id);
          } else {
            setPipelineStage("awaiting_crop");
            setPipelineMessage("Confirm your stacked crop to continue.");
            openCropEditor(undefined, selectedDownloadedPath);
          }
          return;
        }

        const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildProcessRequestBody(selectedDownloadedPath, config)),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create process job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setProcessJobId(data.job_id);
        processStartedAtRef.current = Date.now();
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

  async function confirmConfigureHighlight() {
    const config: HighlightConfig = {
      layout: highlightConfigDraft.layout,
      subtitle_style: {
        color: highlightConfigDraft.subtitle_style.color,
        font_family: highlightConfigDraft.subtitle_style.font_family,
        font_size: DEFAULT_SUBTITLE_STYLE.font_size,
        outline: DEFAULT_SUBTITLE_STYLE.outline,
        shadow: DEFAULT_SUBTITLE_STYLE.shadow,
      },
      censor_subtitles: highlightConfigDraft.censor_subtitles,
    };

    setIsConfigureHighlightOpen(false);
    await startConfiguredPipeline(config);
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
    setCropEditorRequiresConfirmation(Boolean(processPathAfterSave));
    setIsCropEditorOpen(true);
  }

  function closeCropEditor() {
    setIsCropEditorOpen(false);
    setDragState(null);
    setCropEditorPreviewUrlOverride(null);
    setPendingCropProcessPath(null);

    if (isPostRenderCropMode) {
      setIsPostRenderCropMode(false);
      setCropEditorRequiresConfirmation(false);
      setPipelineStage("completed");
      setPipelineMessage("Crop adjustment cancelled. Original render preserved.");
      return;
    }

    if (cropEditorRequiresConfirmation) {
      setPipelineStage("awaiting_crop");
      setPipelineMessage(
        "Crop confirmation still required before render can continue."
      );
    } else {
      setPipelineStage("idle");
      setPipelineMessage("Crop editor closed. Submit again when ready.");
    }
    setCropEditorRequiresConfirmation(false);
  }

  function saveCropEditor() {
    const newConfig: StackedConfig = {
      top_crop: roundBox(cropDraft.top_crop),
      bottom_crop: roundBox(cropDraft.bottom_crop),
      split_ratio_top: cropDraft.split_ratio_top,
    };

    setStackedConfig(newConfig);
    setIsCropEditorOpen(false);
    setDragState(null);
    setCropEditorPreviewUrlOverride(null);
    setCropEditorRequiresConfirmation(false);

    if (isPostRenderCropMode) {
      setIsPostRenderCropMode(false);
      void startCropRerender(newConfig);
      return;
    }

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

  function openCropAdjust() {
    const configUsed = processResult?.stacked_config_used ?? stackedConfig;
    const inputPath = processJobStatus?.payload?.input_path as string | undefined;

    const matchingClip = inputPath
      ? downloadedClips.find((c) => c.download_path === inputPath)
      : null;
    const previewUrl = matchingClip
      ? `${API_BASE_URL}${matchingClip.url}`
      : cropEditorPreviewUrl;

    if (!previewUrl) {
      setRequestError(
        "Cannot open crop editor: original source video not available."
      );
      return;
    }

    setCropDraft({
      top_crop: { ...configUsed.top_crop },
      bottom_crop: { ...configUsed.bottom_crop },
      split_ratio_top: configUsed.split_ratio_top,
    });

    setCropEditorPreviewUrlOverride(previewUrl);
    setIsPostRenderCropMode(true);
    setIsCropEditorOpen(true);
  }

  async function startCropRerender(newConfig: StackedConfig) {
    const inputPath = processJobStatus?.payload?.input_path as string | undefined;
    const captionsAssPath = processResult?.captions?.ass_path ?? null;

    if (!inputPath) {
      setRequestError("Cannot re-render: original source path not found.");
      return;
    }

    setRequestError(null);
    setPipelineStage("processing");
    setPipelineMessage("Starting crop re-render with updated crop...");
    cropSourceRef.current = "manual";

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/crop-rerender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_path: inputPath,
          stacked_config: newConfig,
          captions_ass_path: captionsAssPath,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create crop rerender job (${response.status}): ${errorText}`
        );
      }

      const data: JobCreateResponse = await response.json();
      setCropRerenderJobId(data.job_id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown crop rerender error";
      setRequestError(message);
      setPipelineStage("failed");
      setPipelineMessage("Crop rerender failed to start.");
    }
  }

  function openAddSubtitles() {
    setSubtitleDrafts([]);
    setSavedSubtitleDrafts([]);
    setIsSubtitleEditorOpen(true);
  }

  function openSubtitleEditor() {
    const latestCaptionItems = generatedCaptionItems;

    if (latestCaptionItems.length > 0) {
      const nextDrafts = latestCaptionItems.map(toEditableCaptionDraft);
      setSubtitleDrafts(nextDrafts);
      setSavedSubtitleDrafts(nextDrafts);
      setIsSubtitleEditorOpen(true);
      return;
    }

    if (savedSubtitleDrafts.length === 0) return;

    setSubtitleDrafts(savedSubtitleDrafts.map((caption) => ({ ...caption })));
    setIsSubtitleEditorOpen(true);
  }

  function closeSubtitleEditor() {
    setIsSubtitleEditorOpen(false);
  }

  function resetSubtitleEditor() {
    setSubtitleDrafts(savedSubtitleDrafts.map((caption) => ({ ...caption })));
  }

  function saveSubtitleEditor() {
    const sanitizedDrafts = subtitleDrafts.map(sanitizeCaptionDraft);
    setSavedSubtitleDrafts(sanitizedDrafts);
    setSubtitleDrafts(sanitizedDrafts);
    setIsSubtitleEditorOpen(false);
  }

  function addSubtitleDraft() {
    setSubtitleDrafts((current) => [
      ...current,
      createNewCaptionDraft(current, highlightConfig.subtitle_style),
    ]);
  }

  function removeSubtitleDraft(id: number) {
    setSubtitleDrafts((current) => current.filter((caption) => caption.id !== id));
  }

  function updateSubtitleStyle(
    index: number,
    field: "color" | "font_family" | "font_size" | "outline" | "shadow",
    value: string | number
  ) {
    setSubtitleDrafts((current) =>
      current.map((caption, currentIndex) => {
        if (currentIndex !== index) return caption;

        return {
          ...caption,
          style: {
            ...caption.style,
            [field]: value,
          },
        };
      })
    );
  }

  function updateSubtitlePlacement(
    index: number,
    field: "track" | "x" | "y" | "align",
    value: string | number | null
  ) {
    setSubtitleDrafts((current) =>
      current.map((caption, currentIndex) => {
        if (currentIndex !== index) return caption;

        return {
          ...caption,
          placement: {
            ...caption.placement,
            [field]: value,
          },
        };
      })
    );
  }

  async function applySubtitleEdits() {
    const baseResult = processResult;
    const inputVideoPath =
      (baseResult as (ProcessJobResult & { base_output_path?: string }) | null)
        ?.base_output_path ?? baseResult?.output_path;
    const captionsJsonPath = baseResult?.captions?.captions_json_path ?? null;

    if (!inputVideoPath) {
      setRequestError(
        "Subtitle rerender requires an existing processed video."
      );
      return;
    }

    const sanitizedDrafts = subtitleDrafts.map(sanitizeCaptionDraft);

    setSavedSubtitleDrafts(sanitizedDrafts);
    setSubtitleDrafts(sanitizedDrafts);
    setIsApplyingSubtitleEdits(true);
    setIsSubtitleEditorOpen(false);
    setRequestError(null);
    setPipelineStage("subtitle_rerender");
    setPipelineMessage("Saving subtitle edits and starting rerender...");

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/subtitle-rerender`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_video_path: inputVideoPath,
          captions_json_path: captionsJsonPath,
          items: sanitizedDrafts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create subtitle rerender job (${response.status}): ${errorText}`
        );
      }

      const data: JobCreateResponse = await response.json();
      setSubtitleRerenderJobId(data.job_id);
      setSubtitleRerenderJobStatus(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown subtitle rerender error";
      setRequestError(message);
      setPipelineStage("failed");
      setPipelineMessage("Subtitle rerender failed to start.");
      setIsApplyingSubtitleEdits(false);
    }
  }

  function updateSubtitleDraft(
    index: number,
    field: "start" | "end" | "final_text",
    value: number | string
  ) {
    setSubtitleDrafts((current) =>
      current.map((caption, currentIndex) => {
        if (currentIndex !== index) return caption;

        if (field === "final_text") {
          return {
            ...caption,
            final_text: String(value),
          };
        }

        const numericValue =
          typeof value === "number" && Number.isFinite(value) ? value : 0;

        return {
          ...caption,
          [field]: numericValue,
        };
      })
    );
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

          const submittedLayout = submittedHighlightConfigRef.current.layout;
          const submittedSourceMode = submittedSourceModeRef.current;

          if (submittedLayout === "stacked" && submittedSourceMode !== "downloaded_file") {
            setSelectedDownloadedPath(path);

            if (uiMode === "ai") {
              setPipelineStage("analyzing_layout");
              setPipelineMessage("Download complete — analysing stacked crop regions with AI...");
              setPendingAnalysisProcessPath(path);
              clearInterval(intervalId);
              setDownloadJobId(null);

              try {
                const analysisResponse = await fetch(
                  `${API_BASE_URL}/jobs/analyze-layout`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      input_path: path,
                      vision_model: null,
                    }),
                  }
                );

                if (!analysisResponse.ok) {
                  const errorText = await analysisResponse.text();
                  throw new Error(
                    `Layout analysis job failed to start (${analysisResponse.status}): ${errorText}`
                  );
                }

                const analysisData: JobCreateResponse = await analysisResponse.json();
                setLayoutAnalysisJobId(analysisData.job_id);
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Layout analysis request error";
                setRequestError(message);
                setPipelineStage("failed");
                setPipelineMessage("Layout analysis failed to start.");
              }
              return;
            }

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
          body: JSON.stringify(
            buildProcessRequestBody(inputPath, submittedHighlightConfigRef.current)
          ),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create process job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setProcessJobId(data.job_id);
        processStartedAtRef.current = Date.now();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process request error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Process request failed.");
      }
    }

    void startProcessJob();
  }, [downloadedPath, processJobId, stackedConfig]);

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
          if (processStartedAtRef.current) {
            setProcessingDurationMs(Date.now() - processStartedAtRef.current);
          }
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
    if (!layoutAnalysisJobId) return;

    async function fetchLayoutAnalysisJobStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${layoutAnalysisJobId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch layout analysis job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setLayoutAnalysisJobStatus(data);

        if (data.status === "queued" || data.status === "processing") {
          setPipelineStage("analyzing_layout");
          setPipelineMessage("Analysing stacked crop regions with AI...");
        }

        if (data.status === "completed") {
          const result = data.result as LayoutAnalysisJobResult | null;
          const topCropHint = result?.top_crop_hint;
          const bottomCropHint = result?.bottom_crop_hint;
          const hasValidHints =
            topCropHint &&
            bottomCropHint &&
            topCropHint.w > 0 &&
            topCropHint.h > 0 &&
            bottomCropHint.w > 0 &&
            bottomCropHint.h > 0;

          const processPath = pendingAnalysisProcessPath;
          setPendingAnalysisProcessPath(null);
          setLayoutAnalysisJobId(null);
          clearInterval(intervalId);

          if (hasValidHints) {
            setStackedConfig({
              top_crop: {
                x: topCropHint!.x,
                y: topCropHint!.y,
                w: topCropHint!.w,
                h: topCropHint!.h,
              },
              bottom_crop: {
                x: bottomCropHint!.x,
                y: bottomCropHint!.y,
                w: bottomCropHint!.w,
                h: bottomCropHint!.h,
              },
              split_ratio_top: DEFAULT_STACKED_CONFIG.split_ratio_top,
            });
            setAiCropStatus("success");
            cropSourceRef.current = "ai";
            setPipelineStage("processing");
            setPipelineMessage(
              `AI detected crop regions — processing automatically.${result?.reasoning ? ` (${result.reasoning})` : ""}`
            );
            setDownloadedPath(processPath);
          } else {
            setAiCropStatus("failed");
            setAiCropReasoning(
              result?.reasoning
                ? `Detection returned unusable coordinates. ${result.reasoning}`
                : "AI returned no usable crop coordinates."
            );
            setPipelineStage("awaiting_crop");
            setPipelineMessage("AI crop detection could not determine valid regions — manual crop required.");
            if (processPath) {
              openCropEditor(undefined, processPath);
            }
          }
        }

        if (data.status === "failed") {
          setAiCropStatus("failed");
          setAiCropReasoning("AI crop detection job failed. Using default crop boxes.");
          const processPath = pendingAnalysisProcessPath;
          setPendingAnalysisProcessPath(null);
          setLayoutAnalysisJobId(null);
          clearInterval(intervalId);
          setPipelineStage("awaiting_crop");
          setPipelineMessage("AI crop detection failed — manual crop required.");
          if (processPath) {
            openCropEditor(undefined, processPath);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown layout analysis polling error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Layout analysis polling failed.");
        clearInterval(intervalId);
      }
    }

    const intervalId = setInterval(() => {
      void fetchLayoutAnalysisJobStatus();
    }, 2000);
    void fetchLayoutAnalysisJobStatus();

    return () => clearInterval(intervalId);
  }, [layoutAnalysisJobId]);

  useEffect(() => {
    if (!subtitleRerenderJobId) return;

    async function fetchSubtitleRerenderJobStatus() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/jobs/${subtitleRerenderJobId}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch subtitle rerender job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setSubtitleRerenderJobStatus(data);

        if (data.status === "queued") {
          setPipelineStage("subtitle_rerender");
          setPipelineMessage("Subtitle rerender queued...");
        }

        if (data.status === "processing") {
          setPipelineStage("subtitle_rerender");
          setPipelineMessage("Applying subtitle edits and rendering updated video...");
        }

        if (data.status === "completed") {
          const result = data.result as SubtitleRerenderJobResult | null;
          const updatedItems = result?.captions?.items ?? [];

          if (updatedItems.length > 0) {
            const nextDrafts = updatedItems.map(toEditableCaptionDraft);
            setSavedSubtitleDrafts(nextDrafts);
            setSubtitleDrafts(nextDrafts);
          }

          setPipelineStage("completed");
          setPipelineMessage("Subtitle edits applied. Updated video is ready.");
          setIsApplyingSubtitleEdits(false);
          clearInterval(intervalId);
        }

        if (data.status === "failed") {
          setPipelineStage("failed");
          setPipelineMessage("Subtitle rerender failed.");
          setIsApplyingSubtitleEdits(false);
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown subtitle rerender polling error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Subtitle rerender polling failed.");
        setIsApplyingSubtitleEdits(false);
        clearInterval(intervalId);
      }
    }

    const intervalId = setInterval(() => {
      void fetchSubtitleRerenderJobStatus();
    }, 2000);

    void fetchSubtitleRerenderJobStatus();

    return () => clearInterval(intervalId);
  }, [subtitleRerenderJobId]);

  useEffect(() => {
    if (!cropRerenderJobId) return;

    async function fetchCropRerenderJobStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${cropRerenderJobId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch crop rerender job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setCropRerenderJobStatus(data);

        if (data.status === "queued") {
          setPipelineStage("processing");
          setPipelineMessage("Crop rerender queued...");
        }

        if (data.status === "processing") {
          setPipelineStage("processing");
          setPipelineMessage("Rendering updated stacked crop...");
        }

        if (data.status === "completed") {
          const result = data.result as CropRerenderJobResult | null;

          if (result?.output_url) {
            setProcessJobStatus((current) => {
              if (!current) return current;
              const currentResult = current.result as ProcessJobResult | null;
              return {
                ...current,
                result: {
                  ...currentResult,
                  output_url: result.output_url,
                  filename: result.filename ?? currentResult?.filename,
                  stacked_config_used:
                    result.stacked_config_used ?? currentResult?.stacked_config_used,
                  crop_source: result.crop_source ?? "manual",
                },
              };
            });
          }

          setSubtitleRerenderJobStatus(null);
          setPipelineStage("completed");
          setPipelineMessage("Crop re-render complete.");
          setCropRerenderJobId(null);
          clearInterval(intervalId);
        }

        if (data.status === "failed") {
          setPipelineStage("failed");
          setPipelineMessage("Crop rerender failed.");
          setCropRerenderJobId(null);
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown crop rerender polling error";
        setRequestError(message);
        setPipelineStage("failed");
        setPipelineMessage("Crop rerender polling failed.");
        clearInterval(intervalId);
      }
    }

    const intervalId = setInterval(() => {
      void fetchCropRerenderJobStatus();
    }, 2000);
    void fetchCropRerenderJobStatus();

    return () => clearInterval(intervalId);
  }, [cropRerenderJobId]);

  useEffect(() => {
    if (
      (pipelineStage === "processing" ||
        pipelineStage === "subtitle_rerender") &&
      previousPipelineStageRef.current !== pipelineStage
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
      : pipelineStage === "analyzing_layout"
      ? "Analysing layout..."
      : pipelineStage === "awaiting_crop"
      ? "Waiting for crop..."
      : pipelineStage === "processing"
      ? "Processing..."
      : pipelineStage === "subtitle_rerender"
      ? "Applying subtitle edits..."
      : "Configure Highlight";

  const statusTone =
    overallStatus === "completed"
      ? "text-green-400"
      : overallStatus === "failed"
      ? "text-red-400"
      : overallStatus === "awaiting_crop"
      ? "text-amber-400"
      : overallStatus === "submitting" ||
        overallStatus === "downloading" ||
        overallStatus === "download_complete" ||
        overallStatus === "analyzing_layout" ||
        overallStatus === "processing" ||
        overallStatus === "subtitle_rerender"
      ? "text-blue-400"
      : "text-zinc-400";

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
              currentHighlightConfig={highlightConfig}
              hideModeBadge={hideModeBadge}
              isSubmitting={isSubmitting}
              layout={layout}
              selectedDownloadedPath={selectedDownloadedPath}
              selectedTwitchClip={selectedTwitchClip}
              sourceMode={sourceMode}
              stackedConfig={stackedConfig}
              stackedConfigIsValid={stackedConfigIsValid}
              submitButtonLabel={submitButtonLabel}
              twitchUser={twitchUser}
              uiMode={uiMode}
              uiModeLocked={uiModeLocked}
              onClipUrlChange={setClipUrl}
              onOpenConfigureHighlight={openConfigureHighlight}
              onOpenCropEditor={() => openCropEditor()}
              onSourceModeChange={setSourceMode}
              onToggleUiMode={() =>
                setUiMode((current) => (current === "ai" ? "non_ai" : "ai"))
              }
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
            />
          </aside>

          <section>
            {sourceMode === "twitch_clips" ? (
              <TwitchClipsPanel
                selectedTwitchClip={selectedTwitchClip}
                twitchClips={twitchClips}
                twitchUser={twitchUser}
                onSelectTwitchClip={handleSelectTwitchClip}
                onUseClipAsUrl={handleUseClipAsUrl}
              />
            ) : sourceMode === "twitch_url" ? (
              <TwitchUrlPanel clipUrl={clipUrl} onClipUrlChange={setClipUrl} />
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
          </section>
        </div>

        <div className="mt-6">
          <OutputPreviewPanel
            captionItems={generatedCaptionItems}
            onAddSubtitles={openAddSubtitles}
            onOpenCropAdjust={openCropAdjust}
            onOpenSubtitleEditor={openSubtitleEditor}
            outputVideoUrl={outputVideoUrl}
            pipelineMessage={pipelineMessage}
            pipelineStage={pipelineStage}
            processJobStatus={processJobStatus}
            processingDurationMs={processingDurationMs}
            sectionRef={outputPreviewRef}
            uiMode={uiMode}
          />
        </div>
      </div>

      <ConfigureHighlightModal
        draftConfig={highlightConfigDraft}
        isOpen={isConfigureHighlightOpen}
        isSubmitting={isSubmitting}
        uiMode={uiMode}
        onChangeColor={(color) =>
          setHighlightConfigDraft((current) => ({
            ...current,
            subtitle_style: {
              ...current.subtitle_style,
              color,
            },
          }))
        }
        onChangeFontFamily={(fontFamily) =>
          setHighlightConfigDraft((current) => ({
            ...current,
            subtitle_style: {
              ...current.subtitle_style,
              font_family: fontFamily,
            },
          }))
        }
        onChangeLayout={(nextLayout) =>
          setHighlightConfigDraft((current) => ({
            ...current,
            layout: nextLayout,
          }))
        }
        onClose={closeConfigureHighlight}
        onConfirm={confirmConfigureHighlight}
        onToggleCensor={() =>
          setHighlightConfigDraft((current) => ({
            ...current,
            censor_subtitles: !current.censor_subtitles,
          }))
        }
      />

      <CropEditorModal
        aiCropReasoning={aiCropReasoning}
        aiCropStatus={aiCropStatus}
        bottomPreviewStyle={bottomPreviewStyle}
        cropDraft={cropDraft}
        cropEditorPreviewUrl={cropEditorPreviewUrl}
        cropSource={processResult?.crop_source ?? null}
        hideModeBadge={hideModeBadge}
        isOpen={isCropEditorOpen}
        isPostRenderMode={isPostRenderCropMode}
        uiMode={uiMode}
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

      <SubtitleEditorModal
        captions={subtitleDrafts}
        isApplying={isApplyingSubtitleEdits}
        isOpen={isSubtitleEditorOpen}
        onAddCaption={addSubtitleDraft}
        onApply={applySubtitleEdits}
        onChangeCaption={updateSubtitleDraft}
        onChangePlacement={updateSubtitlePlacement}
        onChangeStyle={updateSubtitleStyle}
        onClose={closeSubtitleEditor}
        onDeleteCaption={removeSubtitleDraft}
        onReset={resetSubtitleEditor}
        onSave={saveSubtitleEditor}
        outputVideoUrl={outputVideoUrl}
      />
    </main>
  );
}