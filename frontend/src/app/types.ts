export type LayoutOption = "cropped" | "fullscreen" | "stacked";
export type SourceMode = "twitch_clips" | "twitch_url" | "downloaded_file";

export type HighlightFontOption =
  | "Montserrat"
  | "Gibson"
  | "Barlow Condensed"
  | "Komika Axis"
  | "Futura"
  | "Arial";

export type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type StackedConfig = {
  top_crop: CropBox;
  bottom_crop: CropBox;
  split_ratio_top: number;
};

export type JobCreateResponse = {
  job_id: string;
  status: string;
};

export type DownloadJobResult = {
  clip_slug?: string;
  download_path?: string;
  filename?: string;
  source_type?: string;
  download_url?: string;
};

export type ProcessCaptionRefinementResult = {
  applied?: boolean;
  model?: string;
  refined_count?: number;
  total_captions?: number;
  error?: string;
};

export type CaptionTrack = "top" | "bottom" | "free";
export type CaptionAlign = "top" | "middle" | "bottom";

export type CaptionStyle = {
  color?: string;
  font_family?: string;
  font_size?: number;
  outline?: number;
  shadow?: number;
};

export type CaptionPlacement = {
  track?: CaptionTrack;
  x?: number | null;
  y?: number | null;
  align?: CaptionAlign;
};

export type HighlightConfig = {
  layout: LayoutOption;
  subtitle_style: {
    color: string;
    font_family: HighlightFontOption;
    font_size: number;
    outline: number;
    shadow: number;
  };
  censor_subtitles: boolean;
};

export type MetadataJsonCaptionsEntry = {
  id?: number;
  start?: number;
  end?: number;
  raw_text?: string;
  refined_text?: string | null;
  final_text?: string | null;
  source?: string;
  refinement_source?: string | null;
  status?: string;
  words?: unknown[];
  is_manual?: boolean;
  style?: CaptionStyle;
  placement?: CaptionPlacement;
};

export type EditableCaptionDraft = {
  id: number;
  start: number;
  end: number;
  raw_text: string;
  refined_text: string;
  final_text: string;
  status: string;
  is_manual: boolean;
  style: {
    color: string;
    font_family: string;
    font_size: number;
    outline: number;
    shadow: number;
  };
  placement: {
    track: CaptionTrack;
    x: number | null;
    y: number | null;
    align: CaptionAlign;
  };
};

export type ProcessCaptionsResult = {
  enabled?: boolean;
  burned_in?: boolean;
  srt_path?: string;
  srt_filename?: string;
  srt_url?: string;
  ass_path?: string;
  ass_filename?: string;
  ass_url?: string;
  captions_json_path?: string;
  captions_json_filename?: string;
  captions_json_url?: string;
  refinement?: ProcessCaptionRefinementResult | null;
  items?: MetadataJsonCaptionsEntry[];
  edited?: boolean;
};

export type ProcessRepresentativeFrameResult = {
  frame_path?: string;
  frame_filename?: string;
  frame_url?: string;
  source?: string;
};

export type ProcessMetadataArtifactResult = {
  metadata_path?: string;
  metadata_filename?: string;
  metadata_url?: string;
};

export type MetadataJsonVisionNotes = {
  scene_description?: string;
  visible_elements?: string[];
  possible_context_tags?: string[];
  visual_tone?: string;
};

export type MetadataJsonPayload = {
  version?: number;
  source?: {
    input_path?: string;
    input_filename?: string;
    source_type?: string;
  };
  render?: {
    layout?: string;
    output_path?: string;
    output_filename?: string;
    output_url?: string;
  };
  config?: {
    job_id?: string;
    layout?: string;
    stacked_config?: unknown;
    captions?: {
      enabled?: boolean;
      burn_in?: boolean;
      refine_with_llm?: boolean;
      refinement_model?: string | null;
      censor_subtitles?: boolean;
      default_style?: CaptionStyle | null;
    };
    metadata?: {
      enabled?: boolean;
      vision_model?: string | null;
      metadata_model?: string | null;
    };
  };
  representative_frame?: {
    frame_path?: string;
    frame_filename?: string;
    frame_url?: string;
    source?: string;
  };
  captions?: {
    enabled?: boolean;
    burned_in?: boolean;
    srt_path?: string;
    srt_filename?: string;
    srt_url?: string;
    ass_path?: string;
    ass_filename?: string;
    ass_url?: string;
    captions_json_path?: string;
    captions_json_filename?: string;
    captions_json_url?: string;
    refinement?: ProcessCaptionRefinementResult | null;
    items?: MetadataJsonCaptionsEntry[];
  };
  vision?: {
    status?: string;
    notes?: MetadataJsonVisionNotes | null;
    model?: string | null;
    reason?: string | null;
  };
  metadata_generation?: {
    status?: string;
    title_suggestions?: string[];
    hashtag_suggestions?: string[];
    summary?: string | null;
    tone_tags?: string[];
    category_tags?: string[];
    model?: string | null;
    reason?: string | null;
  };
};

export type ProcessJobResult = {
  output_path?: string;
  filename?: string;
  layout?: string;
  output_url?: string;
  base_output_path?: string;
  base_output_url?: string;
  base_filename?: string;
  captions?: ProcessCaptionsResult;
  representative_frame?: ProcessRepresentativeFrameResult;
  metadata?: ProcessMetadataArtifactResult & {
    payload?: MetadataJsonPayload;
  };
};

export type SubtitleRerenderJobResult = {
  output_path?: string;
  filename?: string;
  output_url?: string;
  captions?: ProcessCaptionsResult;
};

export type JobStatusResponse = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: DownloadJobResult | ProcessJobResult | SubtitleRerenderJobResult | null;
  error: string | null;
};

export type DownloadedClip = {
  filename: string;
  download_path: string;
  url: string;
};

export type DownloadedClipsResponse = {
  clips: DownloadedClip[];
  count: number;
};

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url?: string;
};

export type TwitchClip = {
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

export type OAuthPayload = {
  message: string;
  user: TwitchUser;
  clips: TwitchClip[];
  clip_count: number;
  token_type?: string;
  expires_in?: number;
  scope?: string[];
};

export type DragTarget = "top_crop" | "bottom_crop";
export type DragMode = "move" | "resize";

export type DragState = {
  target: DragTarget;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startBox: CropBox;
} | null;

export type PipelineStage =
  | "idle"
  | "submitting"
  | "downloading"
  | "download_complete"
  | "analyzing_layout"
  | "awaiting_crop"
  | "processing"
  | "subtitle_rerender"
  | "completed"
  | "failed";

export type UiMode = "ai" | "non_ai";

export type LayoutAnalysisJobResult = {
  applied?: boolean;
  status?: string;
  model?: string;
  reason?: string;
  suggested_layout?: LayoutOption | null;
  confidence?: number | null;
  reasoning?: string | null;
  top_crop_hint?: { x: number; y: number; w: number; h: number } | null;
  bottom_crop_hint?: { x: number; y: number; w: number; h: number } | null;
  frame?: {
    frame_path?: string;
    frame_filename?: string;
    frame_url?: string;
  };
};