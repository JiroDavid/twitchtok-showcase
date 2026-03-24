from typing import Literal, Optional

from pydantic import BaseModel, HttpUrl


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


class VideoProcessJobRequest(BaseModel):
    input_path: str
    layout: Literal["cropped", "fullscreen", "stacked"]
    stacked_config: Optional[StackedConfig] = None


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