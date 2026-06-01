"use client";

import type { DemoConfig, HighlightFontOption, LayoutOption } from "../../types";

const FONT_OPTIONS: HighlightFontOption[] = [
  "Montserrat",
  "Barlow Condensed",
  "Gibson",
  "Komika Axis",
  "Futura",
  "Arial",
];

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#FFFFFF", label: "White" },
  { value: "#D4AF0D", label: "Gold" },
  { value: "#9146FF", label: "Purple" },
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
];

const LAYOUT_OPTIONS: { value: LayoutOption; label: string; description: string }[] = [
  { value: "cropped",    label: "Cropped",    description: "Center crop to 9:16" },
  { value: "fullscreen", label: "Fullscreen", description: "Blurred background" },
  { value: "stacked",    label: "Stacked",    description: "Facecam + gameplay" },
];

type StyleConfiguratorProps = {
  config: DemoConfig;
  onConfigChange: (config: DemoConfig) => void;
  selectedClipIndex: number | null;
  onGenerate: () => void;
};

export function StyleConfigurator({
  config,
  onConfigChange,
  selectedClipIndex,
  onGenerate,
}: StyleConfiguratorProps) {
  return (
    <div className="rounded-xl border-l-4 border-[#9146FF] bg-zinc-900 p-6">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#9146FF]">
        Step 2 -- Customise
      </p>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-xs text-zinc-500">Font</label>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font}
                onClick={() => onConfigChange({ ...config, font })}
                className={`rounded-md px-3 py-1.5 text-xs transition-all duration-100 ${
                  config.font === font
                    ? "bg-[#9146FF] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                }`}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-zinc-500">Caption colour</label>
          <div className="flex gap-3">
            {COLOR_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                title={label}
                onClick={() => onConfigChange({ ...config, color: value })}
                className={`h-6 w-6 rounded-full transition-all duration-100 ${
                  config.color === value
                    ? "scale-125 ring-2 ring-[#9146FF] ring-offset-2 ring-offset-zinc-900"
                    : "hover:scale-110"
                }`}
                style={{
                  backgroundColor: value,
                  border: value === "#FFFFFF" ? "1px solid #52525b" : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-zinc-500">Layout</label>
          <div className="flex gap-2">
            {LAYOUT_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => onConfigChange({ ...config, layout: value })}
                className={`flex-1 rounded-md px-3 py-2 text-left transition-all duration-100 ${
                  config.layout === value
                    ? "border border-[#9146FF] bg-[#9146FF]/10 text-zinc-100"
                    : "border border-zinc-800 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-[10px] text-zinc-500">{description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={selectedClipIndex === null}
        className="mt-6 w-full rounded-lg bg-[#9146FF] py-3 text-sm font-bold text-white shadow-[0_2px_12px_rgba(145,70,255,0.4)] transition-all hover:bg-[#7c3aed] hover:shadow-[0_4px_20px_rgba(145,70,255,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Generate Highlight
      </button>
    </div>
  );
}
