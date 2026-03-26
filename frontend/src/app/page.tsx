"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LayoutOption = "cropped" | "fullscreen" | "stacked";

type JobCreateResponse = {
  job_id: string;
  status: string;
};

type DownloadJobResult = {
  clip_slug?: string;
  download_path?: string;
  filename?: string;
  source_type?: string;
};

type ProcessJobResult = {
  output_path?: string;
  filename?: string;
  layout?: string;
  output_url?: string;
};

type JobStatusResponse = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: DownloadJobResult | ProcessJobResult | null;
  error: string | null;
};

const API_BASE_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [clipUrl, setClipUrl] = useState(
    "https://clips.twitch.tv/AuspiciousAnimatedDelicataSoonerLater-0B3bBhlmYjXEWKEs"
  );
  const [layout, setLayout] = useState<LayoutOption>("cropped");

  const [downloadJobId, setDownloadJobId] = useState<string | null>(null);
  const [downloadJobStatus, setDownloadJobStatus] =
    useState<JobStatusResponse | null>(null);

  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

  const [processJobId, setProcessJobId] = useState<string | null>(null);
  const [processJobStatus, setProcessJobStatus] =
    useState<JobStatusResponse | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const outputVideoUrl = useMemo(() => {
    const result = processJobStatus?.result as ProcessJobResult | null;
    const outputUrl = result?.output_url;
    if (!outputUrl) return null;
    return `${API_BASE_URL}${outputUrl}`;
  }, [processJobStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setRequestError(null);

    setDownloadJobId(null);
    setDownloadJobStatus(null);
    setDownloadedPath(null);

    setProcessJobId(null);
    setProcessJobStatus(null);

    try {
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";
      setRequestError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!downloadJobId) return;

    let intervalId: ReturnType<typeof setInterval>;

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

        if (data.status === "completed") {
          const result = data.result as DownloadJobResult | null;
          const path = result?.download_path;

          if (!path) {
            setRequestError(
              "Download job completed but no download_path was returned."
            );
            clearInterval(intervalId);
            return;
          }

          setDownloadedPath(path);
          clearInterval(intervalId);
        }

        if (data.status === "failed") {
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown download polling error";
        setRequestError(message);
        clearInterval(intervalId);
      }
    }

    fetchDownloadJobStatus();
    intervalId = setInterval(fetchDownloadJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [downloadJobId]);

  useEffect(() => {
    if (!downloadedPath) return;
    if (processJobId) return;

    async function startProcessJob() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input_path: downloadedPath,
            layout,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to create process job (${response.status}): ${errorText}`
          );
        }

        const data: JobCreateResponse = await response.json();
        setProcessJobId(data.job_id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process request error";
        setRequestError(message);
      }
    }

    startProcessJob();
  }, [downloadedPath, layout, processJobId]);

  useEffect(() => {
    if (!processJobId) return;

    let intervalId: ReturnType<typeof setInterval>;

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

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown process polling error";
        setRequestError(message);
        clearInterval(intervalId);
      }
    }

    fetchProcessJobStatus();
    intervalId = setInterval(fetchProcessJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [processJobId]);

  const overallStatus =
    processJobStatus?.status ??
    downloadJobStatus?.status ??
    (isSubmitting ? "submitting" : "idle");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <div className="mb-10">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-violet-400">
            Dissertation Project
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI-Assisted Twitch Clip Editing
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-400 sm:text-lg">
            Paste a Twitch clip URL, let the backend download it, process it
            into a vertical layout, and preview the rendered result.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Twitch Clip Processing</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This is the next step after manual file-path testing. Twitch OAuth
              and clip browsing will come after this flow works cleanly.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="clipUrl"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Twitch clip URL
                </label>
                <input
                  id="clipUrl"
                  type="text"
                  value={clipUrl}
                  onChange={(event) => setClipUrl(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                  placeholder="https://clips.twitch.tv/YourClipSlug"
                />
              </div>

              <div>
                <label
                  htmlFor="layout"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Layout
                </label>
                <select
                  id="layout"
                  value={layout}
                  onChange={(event) =>
                    setLayout(event.target.value as LayoutOption)
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                >
                  <option value="cropped">cropped</option>
                  <option value="fullscreen">fullscreen</option>
                  <option value="stacked">stacked</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Download and Process"}
              </button>
            </form>

            <div className="mt-6 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
              <div>
                <span className="text-zinc-500">Overall status:</span>{" "}
                <span className="text-zinc-200">{overallStatus}</span>
              </div>

              <div>
                <span className="text-zinc-500">Download job ID:</span>{" "}
                <span className="break-all text-zinc-200">
                  {downloadJobId ?? "Not started"}
                </span>
              </div>

              <div>
                <span className="text-zinc-500">Downloaded path:</span>{" "}
                <span className="break-all text-zinc-200">
                  {downloadedPath ?? "Not available yet"}
                </span>
              </div>

              <div>
                <span className="text-zinc-500">Process job ID:</span>{" "}
                <span className="break-all text-zinc-200">
                  {processJobId ?? "Not started"}
                </span>
              </div>

              {downloadJobStatus?.error && (
                <div className="text-red-400">
                  <span className="font-medium">Download error:</span>{" "}
                  {downloadJobStatus.error}
                </div>
              )}

              {processJobStatus?.error && (
                <div className="text-red-400">
                  <span className="font-medium">Process error:</span>{" "}
                  {processJobStatus.error}
                </div>
              )}

              {requestError && (
                <div className="text-red-400">
                  <span className="font-medium">Request error:</span>{" "}
                  {requestError}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Output Preview</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Once the clip is downloaded and processed, the rendered video will
              appear here.
            </p>

            <div className="mt-6 flex min-h-[640px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
              {outputVideoUrl ? (
                <video
                  key={outputVideoUrl}
                  controls
                  className="max-h-[600px] rounded-xl border border-zinc-800"
                  src={outputVideoUrl}
                />
              ) : (
                <div className="text-center text-sm text-zinc-500">
                  No processed video yet. Submit a Twitch clip URL to preview
                  the output.
                </div>
              )}
            </div>

            {processJobStatus?.result && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">Filename:</span>{" "}
                  {(processJobStatus.result as ProcessJobResult).filename ??
                    "N/A"}
                </p>
                <p className="mt-2">
                  <span className="text-zinc-500">Layout:</span>{" "}
                  {(processJobStatus.result as ProcessJobResult).layout ?? "N/A"}
                </p>
                <p className="mt-2 break-all">
                  <span className="text-zinc-500">Output URL:</span>{" "}
                  {(processJobStatus.result as ProcessJobResult).output_url ??
                    "N/A"}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}