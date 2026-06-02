"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoConfig, DemoStage, EditableCaptionDraft } from "./types";
import { applyConfigToCaptions } from "./utils";
import { DemoHero } from "./components/demo/DemoHero";
import { ClipPicker } from "./components/demo/ClipPicker";
import { StyleConfigurator } from "./components/demo/StyleConfigurator";
import { ProcessingWindow } from "./components/demo/ProcessingWindow";
import { RevealPanel } from "./components/demo/RevealPanel";
import { MiniPhonePreview } from "./components/demo/MiniPhonePreview";
import { CropEditorModal } from "./components/CropEditorModal";
import { SubtitleEditorModal } from "./components/SubtitleEditorModal";
import { useDemoCropEditor } from "./components/demo/useDemoCropEditor";
import { useDemoRerender } from "./components/demo/useDemoRerender";

const DEFAULT_CONFIG: DemoConfig = {
  font: "Montserrat",
  color: "#FFFFFF",
  layout: "cropped",
};

export default function Home() {
  const [stage, setStage]                         = useState<DemoStage>("pick");
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [config, setConfig]                       = useState<DemoConfig>(DEFAULT_CONFIG);
  const [outputUrl, setOutputUrl]                 = useState<string | null>(null);

  const [subtitleEditorOpen, setSubtitleEditorOpen] = useState(false);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [demoCaptions, setDemoCaptions] = useState<EditableCaptionDraft[]>([]);

  const cropEditor = useDemoCropEditor(selectedClipIndex, cropEditorOpen);
  const demoRerender = useDemoRerender();
  const rerenderPromiseRef = useRef<Promise<string | null> | null>(null);

  const configureRef  = useRef<HTMLDivElement>(null);
  const processingRef = useRef<HTMLDivElement>(null);
  const revealRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!subtitleEditorOpen || selectedClipIndex === null) return;
    fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
      .then((r) => r.json())
      .then((data: EditableCaptionDraft[] | { captions: EditableCaptionDraft[] }) => {
        setDemoCaptions(Array.isArray(data) ? data : (data.captions ?? []));
      })
      .catch(() => setDemoCaptions([]));
  }, [subtitleEditorOpen, selectedClipIndex]);

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function handleClipSelect(index: number | null) {
    if (index === null) {
      setSelectedClipIndex(null);
      setStage("pick");
      setConfig(DEFAULT_CONFIG);
      return;
    }
    setSelectedClipIndex(index);
    if (stage === "pick") {
      setStage("configure");
      scrollTo(configureRef);
    }
  }

  function handleGenerate() {
    if (selectedClipIndex === null) return;

    // Kick off re-render immediately so it runs during the fake processing window
    rerenderPromiseRef.current = fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
      .then((r) => r.json())
      .then((data: EditableCaptionDraft[] | { captions: EditableCaptionDraft[] }) => {
        const captions = Array.isArray(data) ? data : (data.captions ?? []);
        const styled = applyConfigToCaptions(captions, config);
        return demoRerender.rerenderSubtitles(selectedClipIndex, styled, config.layout);
      })
      .catch(() => null);

    setStage("processing");
    scrollTo(processingRef);
  }

  function handleProcessingComplete(url: string) {
    setOutputUrl(url);
    setStage((prev) => {
      if (prev !== "reveal") scrollTo(revealRef);
      return "reveal";
    });
  }

  function handleReset() {
    setSubtitleEditorOpen(false);
    setCropEditorOpen(false);
    setDemoCaptions([]);
    setStage("pick");
    setSelectedClipIndex(null);
    setConfig(DEFAULT_CONFIG);
    setOutputUrl(null);
    rerenderPromiseRef.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showSteps       = stage !== "pick";
  const showMiniPreview = stage === "configure" || stage === "processing";

  const [audioUnlocked, setAudioUnlocked] = useState(false);

  function handleAudioUnlock() {
    setAudioUnlocked(true);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Audio unlock button */}
      <button
        type="button"
        onClick={handleAudioUnlock}
        title={audioUnlocked ? "Audio enabled" : "Click to enable audio"}
        className={`fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 ${
          audioUnlocked
            ? "border-[#9146FF]/50 bg-[#9146FF]/20 text-[#9146FF]"
            : "border-zinc-700 bg-zinc-900/80 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        }`}
      >
        {audioUnlocked ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        )}
      </button>

      <DemoHero />

      <ClipPicker
        audioUnlocked={audioUnlocked}
        onAudioUnlock={handleAudioUnlock}
        selectedClipIndex={selectedClipIndex}
        onSelect={handleClipSelect}
      />

      {showSteps && (
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <div
            className={`grid gap-8 ${showMiniPreview ? "grid-cols-[1fr_460px]" : "grid-cols-1"}`}
          >
            {/* Steps 2 and 3 */}
            <div className="space-y-6">
              <div ref={configureRef}>
                <StyleConfigurator
                  config={config}
                  onConfigChange={setConfig}
                  selectedClipIndex={selectedClipIndex}
                  onGenerate={handleGenerate}
                />
              </div>

              {stage === "processing" && selectedClipIndex !== null && (
                <div ref={processingRef}>
                  <ProcessingWindow
                    selectedClipIndex={selectedClipIndex}
                    outputUrlPromise={rerenderPromiseRef.current ?? undefined}
                    onComplete={handleProcessingComplete}
                  />
                </div>
              )}
            </div>

            {/* Mini preview: visible during configure + processing only */}
            {showMiniPreview && (
              <MiniPhonePreview
                config={config}
                selectedClipIndex={selectedClipIndex}
              />
            )}
          </div>

          {/* Step 4: full-width reveal */}
          {stage === "reveal" && outputUrl && (
            <div ref={revealRef}>
              <RevealPanel
                outputUrl={outputUrl}
                layout={config.layout}
                selectedClipIndex={selectedClipIndex}
                isProcessing={demoRerender.isProcessing}
                processingError={demoRerender.error}
                onReset={handleReset}
                onOpenSubtitleEditor={() => setSubtitleEditorOpen(true)}
                onOpenCropEditor={() => setCropEditorOpen(true)}
              />
            </div>
          )}
        </div>
      )}
      <CropEditorModal
        layout={config.layout}
        aiCropReasoning={null}
        aiCropStatus={null}
        bottomPreviewStyle={cropEditor.bottomPreviewStyle}
        cropDraft={cropEditor.cropDraft}
        cropEditorPreviewUrl={
          selectedClipIndex !== null ? `/clips/clip${selectedClipIndex + 1}.mp4` : null
        }
        cropSource="manual"
        hideModeBadge={true}
        isOpen={cropEditorOpen}
        isPostRenderMode={true}
        uiMode="non_ai"
        onClose={() => setCropEditorOpen(false)}
        onLoadedData={cropEditor.onLoadedData}
        onLoadedMetadata={cropEditor.onLoadedMetadata}
        onSave={async () => {
          if (selectedClipIndex === null) return;
          const newUrl = await demoRerender.rerenderCrop(selectedClipIndex, cropEditor.cropDraft);
          if (newUrl) {
            setOutputUrl(newUrl);
            setCropEditorOpen(false);
          }
        }}
        onStartDrag={cropEditor.onStartDrag}
        onUpdateSplitRatio={cropEditor.onUpdateSplitRatio}
        previewContainerRef={cropEditor.previewContainerRef}
        topPreviewStyle={cropEditor.topPreviewStyle}
        videoRef={cropEditor.videoRef}
      />

      <SubtitleEditorModal
        captions={demoCaptions}
        isApplying={demoRerender.isProcessing}
        isOpen={subtitleEditorOpen}
        onDuplicateCaption={(template) => {
          setDemoCaptions((prev) => {
            const maxId = prev.reduce((m, c) => Math.max(m, c.id), 0);
            const dur = template.end - template.start;
            return [...prev, { ...template, id: maxId + 1, start: template.end, end: template.end + dur }];
          });
        }}
        onAddCaption={() => {
          setDemoCaptions((prev) => {
            const maxId = prev.reduce((m, c) => Math.max(m, c.id), 0);
            return [
              ...prev,
              {
                id: maxId + 1,
                start: 0,
                end: 1,
                raw_text: "",
                refined_text: "",
                final_text: "",
                status: "draft",
                is_manual: true,
                style: { color: "#FFFFFF", font_family: "Montserrat", font_size: 140, outline: 8, shadow: 3 },
                placement: { track: "bottom", x: null, y: null, align: "bottom" },
              },
            ];
          });
        }}
        onApply={async () => {
          if (selectedClipIndex === null) return;
          const newUrl = await demoRerender.rerenderSubtitles(selectedClipIndex, demoCaptions);
          if (newUrl) {
            setOutputUrl(newUrl);
            setSubtitleEditorOpen(false);
          }
        }}
        onChangeCaption={(index, field, value) => {
          setDemoCaptions((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
          });
        }}
        onChangePlacement={(index, field, value) => {
          setDemoCaptions((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              placement: { ...next[index].placement, [field]: value },
            };
            return next;
          });
        }}
        onChangeTiming={(index, start, end) => {
          setDemoCaptions((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], start, end };
            return next;
          });
        }}
        onChangeStyle={(index, field, value) => {
          setDemoCaptions((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              style: { ...next[index].style, [field]: value },
            };
            return next;
          });
        }}
        onClose={() => setSubtitleEditorOpen(false)}
        onDeleteCaption={(id) =>
          setDemoCaptions((prev) => prev.filter((c) => c.id !== id))
        }
        onReset={() => {
          if (selectedClipIndex === null) return;
          fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
            .then((r) => r.json())
            .then((data: EditableCaptionDraft[] | { captions: EditableCaptionDraft[] }) => {
              setDemoCaptions(Array.isArray(data) ? data : (data.captions ?? []));
            })
            .catch(() => setDemoCaptions([]));
        }}
        onSave={() => setSubtitleEditorOpen(false)}
        outputVideoUrl={outputUrl}
      />
    </main>
  );
}
