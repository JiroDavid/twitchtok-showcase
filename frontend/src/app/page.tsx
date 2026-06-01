"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoConfig, DemoStage, EditableCaptionDraft } from "./types";
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

  const configureRef  = useRef<HTMLDivElement>(null);
  const processingRef = useRef<HTMLDivElement>(null);
  const revealRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!subtitleEditorOpen || selectedClipIndex === null) return;
    fetch(`/demo_cache/clip${selectedClipIndex + 1}/captions.json`)
      .then((r) => r.json())
      .then((data: EditableCaptionDraft[]) => setDemoCaptions(data))
      .catch(() => setDemoCaptions([]));
  }, [subtitleEditorOpen, selectedClipIndex]);

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function handleClipSelect(index: number) {
    setSelectedClipIndex(index);
    if (stage === "pick") {
      setStage("configure");
      scrollTo(configureRef);
    }
  }

  function handleGenerate() {
    setStage("processing");
    scrollTo(processingRef);
  }

  function handleProcessingComplete(url: string) {
    setOutputUrl(url);
    setStage("reveal");
    scrollTo(revealRef);
  }

  function handleReset() {
    setSubtitleEditorOpen(false);
    setCropEditorOpen(false);
    setDemoCaptions([]);
    setStage("pick");
    setSelectedClipIndex(null);
    setConfig(DEFAULT_CONFIG);
    setOutputUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showSteps       = stage !== "pick";
  const showMiniPreview = stage === "configure" || stage === "processing";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <DemoHero />

      <ClipPicker
        selectedClipIndex={selectedClipIndex}
        onSelect={handleClipSelect}
      />

      {showSteps && (
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <div
            className={`grid gap-8 ${showMiniPreview ? "grid-cols-[1fr_120px]" : "grid-cols-1"}`}
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
            .then((data: EditableCaptionDraft[]) => setDemoCaptions(data))
            .catch(() => setDemoCaptions([]));
        }}
        onSave={() => setSubtitleEditorOpen(false)}
        outputVideoUrl={outputUrl}
      />
    </main>
  );
}
