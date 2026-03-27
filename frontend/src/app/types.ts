export type LayoutOption = "cropped" | "fullscreen" | "stacked";
export type SourceMode = "twitch_clips" | "twitch_url" | "downloaded_file";

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

export type ProcessJobResult = {
  output_path?: string;
  filename?: string;
  layout?: string;
  output_url?: string;
};

export type JobStatusResponse = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: DownloadJobResult | ProcessJobResult | null;
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
  | "awaiting_crop"
  | "processing"
  | "completed"
  | "failed";
