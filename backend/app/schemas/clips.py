from pydantic import BaseModel, HttpUrl


class ClipResolveRequest(BaseModel):
    clip_url: HttpUrl


class ClipResolveResponse(BaseModel):
    original_url: str
    clip_slug: str
    source_type: str