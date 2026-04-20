from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class ClipDownloadJobRequest(BaseModel):
    clip_url: HttpUrl


class CropBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class StackedConfig(BaseModel):
    top_crop: CropBox
    bottom_crop: CropBox
    split_ratio_top: float = Field(default=0.4, ge=0.2, le=0.8)


class CaptionStyle(BaseModel):
    color: str = "#FFFFFF"
    font_family: str = "Arial"
    font_size: int = 140
    outline: float = 8
    shadow: float = 3


class CaptionConfig(BaseModel):
    enabled: bool = False
    burn_in: bool = True
    refine_with_llm: bool = False
    refinement_model: Optional[str] = None
    censor_subtitles: bool = False
    default_style: Optional[CaptionStyle] = None


class MetadataConfig(BaseModel):
    enabled: bool = True
    vision_model: Optional[str] = None
    metadata_model: Optional[str] = None


class VideoProcessJobRequest(BaseModel):
    input_path: str
    layout: Literal["cropped", "fullscreen", "stacked"]
    stacked_config: Optional[StackedConfig] = None
    captions: Optional[CaptionConfig] = None
    metadata: Optional[MetadataConfig] = None
    crop_source: Optional[Literal["ai", "manual"]] = None


class CaptionPlacement(BaseModel):
    track: Literal["top", "bottom", "free"] = "bottom"
    x: float | None = None
    y: float | None = None
    align: Literal["top", "middle", "bottom"] = "bottom"


class EditableCaptionItem(BaseModel):
    id: int
    start: float
    end: float
    raw_text: str = ""
    refined_text: Optional[str] = None
    final_text: str
    status: str = "draft"
    is_manual: bool = False
    style: CaptionStyle = Field(default_factory=CaptionStyle)
    placement: CaptionPlacement = Field(default_factory=CaptionPlacement)


class SubtitleRerenderJobRequest(BaseModel):
    input_video_path: str
    captions_json_path: Optional[str] = None
    items: list[EditableCaptionItem]


class CropRerenderJobRequest(BaseModel):
    input_path: str
    stacked_config: StackedConfig
    captions_ass_path: Optional[str] = None


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


class LayoutAnalysisJobRequest(BaseModel):
    input_path: str
    vision_model: Optional[str] = None


class JobStatusResponse(BaseModel):
    id: str
    type: str
    status: str
    payload: dict
    result: dict | None = None
    error: str | None = None