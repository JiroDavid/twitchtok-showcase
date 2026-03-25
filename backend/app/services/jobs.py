from uuid import uuid4


jobs_store: dict[str, dict] = {}


def create_job(job_type: str, payload: dict) -> str:
    job_id = str(uuid4())

    jobs_store[job_id] = {
        "id": job_id,
        "type": job_type,
        "status": "queued",
        "payload": payload,
        "result": None,
        "error": None,
    }

    return job_id


def get_job(job_id: str) -> dict | None:
    return jobs_store.get(job_id)


def update_job_status(
    job_id: str,
    status: str,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    job = jobs_store.get(job_id)
    if not job:
        return

    job["status"] = status

    if result is not None:
        job["result"] = result

    if error is not None:
        job["error"] = error


def list_jobs() -> list[dict]:
    return list(jobs_store.values())