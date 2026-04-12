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


class CaptionConfig(BaseModel):
    enabled: bool = False
    burn_in: bool = True
    refine_with_llm: bool = False
    refinement_model: Optional[str] = None


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


class EditableCaptionItem(BaseModel):
    id: int
    start: float
    end: float
    raw_text: str = ""
    refined_text: Optional[str] = None
    final_text: str
    status: str = "draft"


class SubtitleRerenderJobRequest(BaseModel):
    input_video_path: str
    captions_json_path: str
    items: list[EditableCaptionItem]


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    id: str
    type: str
    status: str
    payload: dict
    result: dict | None = None
    error: str | None = None