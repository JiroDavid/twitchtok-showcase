from pydantic import BaseModel, HttpUrl


class ClipResolveRequest(BaseModel):
    clip_url: HttpUrl


class ClipResolveResponse(BaseModel):
    original_url: str
    clip_slug: str
    source_type: str


class ClipDownloadRequest(BaseModel):
    clip_url: HttpUrl


class ClipDownloadResponse(BaseModel):
    original_url: str
    clip_slug: str
    download_path: str
    filename: str
    source_type: str