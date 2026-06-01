"use client";

import { useRef, useState } from "react";
import type { DemoConfig, DemoStage } from "./types";
import { DemoHero } from "./components/demo/DemoHero";
import { ClipPicker } from "./components/demo/ClipPicker";
import { StyleConfigurator } from "./components/demo/StyleConfigurator";
import { ProcessingWindow } from "./components/demo/ProcessingWindow";
import { RevealPanel } from "./components/demo/RevealPanel";
import { MiniPhonePreview } from "./components/demo/MiniPhonePreview";

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

  const configureRef  = useRef<HTMLDivElement>(null);
  const processingRef = useRef<HTMLDivElement>(null);
  const revealRef     = useRef<HTMLDivElement>(null);

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
                    config={config}
                    onComplete={handleProcessingComplete}
                    onError={() => setStage("configure")}
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
              <RevealPanel outputUrl={outputUrl} onReset={handleReset} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
