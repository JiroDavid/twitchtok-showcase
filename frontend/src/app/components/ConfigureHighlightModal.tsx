"use client";

import type { HighlightConfig, HighlightFontOption, LayoutOption } from "../types";

type ConfigureHighlightModalProps = {
  draftConfig: HighlightConfig;
  isOpen: boolean;
  isSubmitting: boolean;
  onChangeColor: (color: string) => void;
  onChangeFontFamily: (fontFamily: HighlightFontOption) => void;
  onChangeLayout: (layout: LayoutOption) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const FONT_OPTIONS: Array<{
  label: HighlightFontOption;
  previewClassName?: string;
}> = [
  { label: "Montserrat" },
  { label: "Gibson" },
  { label: "Barlow Condensed" },
  { label: "Komika Axis" },
  { label: "Futura" },
  { label: "Arial" },
];

const COLOR_OPTIONS = [
  "#D4AF0D",
  "#FFFFFF",
  "#D13B3B",
  "#3F74C8",
  "#28A84A",
];

function LayoutPreviewCard({
  layout,
  isSelected,
  onClick,
}: {
  layout: LayoutOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  const label =
    layout === "fullscreen"
      ? "Fullscreen"
      : layout === "stacked"
      ? "Stacked"
      : "Cropped";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-4 transition ${
        isSelected
          ? "border-zinc-100 bg-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
          : "border-zinc-800 bg-black hover:border-zinc-600"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-28 w-20 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950">
          {layout === "fullscreen" ? (
            <div className="relative h-20 w-10 rounded-md border border-zinc-500 bg-blue-500/90">
              <div className="absolute left-1 top-1 h-4 w-8 rounded-sm bg-zinc-900/90" />
            </div>
          ) : layout === "stacked" ? (
            <div className="relative h-20 w-10 rounded-md border border-zinc-500 bg-blue-500/90">
              <div className="absolute left-1 top-1 h-4 w-8 rounded-sm bg-red-500/90" />
            </div>
          ) : (
            <div className="relative h-20 w-10 rounded-md border border-zinc-500 bg-blue-500/90">
              <div className="absolute left-[3px] top-1 h-[72px] w-[34px] rounded-sm border-2 border-zinc-200/90" />
            </div>
          )}
        </div>

        <span className="text-sm font-semibold text-zinc-100">{label}</span>
      </div>
    </button>
  );
}

export function ConfigureHighlightModal({
  draftConfig,
  isOpen,
  isSubmitting,
  onChangeColor,
  onChangeFontFamily,
  onChangeLayout,
  onClose,
  onConfirm,
}: ConfigureHighlightModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-black shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-100">
              Configure Your Highlight
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Set your quick edit style before the pipeline starts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-3 py-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close configure highlight modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section>
            <h3 className="text-lg font-semibold text-zinc-100">Template</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(["fullscreen", "stacked", "cropped"] as LayoutOption[]).map(
                (layout) => (
                  <LayoutPreviewCard
                    key={layout}
                    layout={layout}
                    isSelected={draftConfig.layout === layout}
                    onClick={() => onChangeLayout(layout)}
                  />
                )
              )}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-zinc-100">Font Style</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {FONT_OPTIONS.map((font) => {
                const isSelected =
                  draftConfig.subtitle_style.font_family === font.label;

                return (
                  <button
                    key={font.label}
                    type="button"
                    onClick={() => onChangeFontFamily(font.label)}
                    className={`rounded-2xl border px-4 py-4 text-center transition ${
                      isSelected
                        ? "border-zinc-100 bg-zinc-200 text-zinc-900"
                        : "border-zinc-800 bg-black text-zinc-100 hover:border-zinc-600"
                    }`}
                  >
                    <div
                      className="text-3xl font-semibold leading-none"
                      style={{ fontFamily: font.label }}
                    >
                      Ag
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-zinc-100">
              Subtitle Color
            </h3>
            <div className="mt-4 grid grid-cols-5 gap-3">
              {COLOR_OPTIONS.map((color) => {
                const isSelected = draftConfig.subtitle_style.color === color;

                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChangeColor(color)}
                    className={`flex h-12 items-center justify-center rounded-xl border transition ${
                      isSelected
                        ? "border-zinc-100 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select subtitle color ${color}`}
                  >
                    {isSelected ? (
                      <span
                        className={`text-lg font-bold ${
                          color === "#FFFFFF" ? "text-black" : "text-white"
                        }`}
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Censor Subtitles
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Filter profanity from subtitles. Coming later.
                </p>
              </div>

              <div className="relative mt-1 h-7 w-12 rounded-full bg-zinc-900 opacity-60">
                <div className="absolute right-1 top-1 h-5 w-5 rounded-full bg-zinc-100" />
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-zinc-800 bg-black px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Starting..." : "Confirm & Process"}
          </button>
        </div>
      </div>
    </div>
  );
}