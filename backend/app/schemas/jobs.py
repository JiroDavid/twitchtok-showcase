from pydantic import BaseModel, HttpUrl


class ClipDownloadJobRequest(BaseModel):
    clip_url: HttpUrl


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