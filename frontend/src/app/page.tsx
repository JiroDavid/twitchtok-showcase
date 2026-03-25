"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LayoutOption = "cropped" | "fullscreen" | "stacked";

type JobResponse = {
  job_id: string;
  status: string;
};

type JobStatusResponse = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: {
    output_path?: string;
    filename?: string;
    layout?: string;
    output_url?: string;
  } | null;
  error: string | null;
};

const API_BASE_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [inputPath, setInputPath] = useState(
    "storage/downloads/AuspiciousAnimatedDelicataSoonerLater-0B3bBhlmYjXEWKEs.mp4"
  );
  const [layout, setLayout] = useState<LayoutOption>("cropped");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const outputVideoUrl = useMemo(() => {
    const outputUrl = jobStatus?.result?.output_url;
    if (!outputUrl) return null;
    return `${API_BASE_URL}${outputUrl}`;
  }, [jobStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setRequestError(null);
    setJobId(null);
    setJobStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/process-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_path: inputPath,
          layout,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create job (${response.status}): ${errorText}`
        );
      }

      const data: JobResponse = await response.json();
      setJobId(data.job_id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";
      setRequestError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;

    let intervalId: NodeJS.Timeout;

    async function fetchJobStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch job status (${response.status}): ${errorText}`
          );
        }

        const data: JobStatusResponse = await response.json();
        setJobStatus(data);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(intervalId);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown polling error";
        setRequestError(message);
        clearInterval(intervalId);
      }
    }

    fetchJobStatus();
    intervalId = setInterval(fetchJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId]);

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
            Test the backend render pipeline from the frontend by submitting a
            local clip path, choosing a vertical layout, polling the job status,
            and previewing the processed result.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Process Video</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use a backend storage path for now. This is a temporary testing
              flow before clip selection and manual crop UI.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="inputPath"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Input video path
                </label>
                <input
                  id="inputPath"
                  type="text"
                  value={inputPath}
                  onChange={(event) => setInputPath(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                  placeholder="storage/downloads/example.mp4"
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
                {isSubmitting ? "Submitting..." : "Process Video"}
              </button>
            </form>

            <div className="mt-6 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
              <div>
                <span className="text-zinc-500">Job ID:</span>{" "}
                <span className="break-all text-zinc-200">
                  {jobId ?? "No job submitted yet"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Status:</span>{" "}
                <span className="text-zinc-200">
                  {jobStatus?.status ?? "idle"}
                </span>
              </div>
              {jobStatus?.error && (
                <div className="text-red-400">
                  <span className="font-medium">Job error:</span>{" "}
                  {jobStatus.error}
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
              Once processing completes, the rendered video will appear here.
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
                  No processed video yet. Submit a job to preview the output.
                </div>
              )}
            </div>

            {jobStatus?.result && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">Filename:</span>{" "}
                  {jobStatus.result.filename ?? "N/A"}
                </p>
                <p className="mt-2">
                  <span className="text-zinc-500">Layout:</span>{" "}
                  {jobStatus.result.layout ?? "N/A"}
                </p>
                <p className="mt-2 break-all">
                  <span className="text-zinc-500">Output URL:</span>{" "}
                  {jobStatus.result.output_url ?? "N/A"}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}