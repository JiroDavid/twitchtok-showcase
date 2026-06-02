import type { CropBox, DemoConfig, EditableCaptionDraft } from "./types";

const FONT_TO_SYSTEM: Record<string, string> = {
  Montserrat: "Montserrat",
  "Barlow Condensed": "Barlow Condensed",
  Gibson: "Arial",
  "Komika Axis": "Impact",
  Futura: "Century Gothic",
  Arial: "Arial",
};

export function applyConfigToCaptions(
  captions: EditableCaptionDraft[],
  config: DemoConfig,
): EditableCaptionDraft[] {
  return captions.map((c) => ({
    ...c,
    style: {
      ...c.style,
      // Top-track captions keep their own color (e.g. pink for a second speaker).
      // Bottom-track captions use the config color picker.
      color: c.placement?.track === "top" ? (c.style?.color ?? config.color) : config.color,
      font_family: FONT_TO_SYSTEM[config.font] ?? config.font,
    },
  }));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundBox(box: CropBox): CropBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
  };
}
