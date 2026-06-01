import type { DemoConfig, HighlightFontOption } from "../../types";

// Approximations for fonts not available as Google Fonts.
// Montserrat and Barlow Condensed load exactly via next/font/google.
const FONT_FAMILY_MAP: Record<HighlightFontOption, string> = {
  Montserrat: "var(--font-montserrat), sans-serif",
  "Barlow Condensed": "var(--font-barlow-condensed), sans-serif",
  Gibson: "var(--font-geist-sans), sans-serif",
  "Komika Axis": "Impact, 'Arial Black', sans-serif",
  Futura: "'Century Gothic', 'Trebuchet MS', sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
};

type MiniPhonePreviewProps = {
  config: DemoConfig;
  selectedClipIndex: number | null;
};

export function MiniPhonePreview({ config, selectedClipIndex }: MiniPhonePreviewProps) {
  return (
    <div className="sticky top-8 text-center">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
        Live Preview
      </p>

      <div className="mx-auto w-[76px] rounded-[14px] border-2 border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
        <div className="flex h-2 items-center justify-center rounded-t-sm bg-zinc-800">
          <div className="h-0.5 w-3.5 rounded-full bg-zinc-700" />
        </div>

        <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "9 / 16" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1020] to-zinc-950" />
          {selectedClipIndex !== null && (
            <div className="absolute bottom-0 left-0 right-0 p-1">
              <div
                className="rounded px-1 py-0.5 text-center text-[6px] font-extrabold uppercase tracking-wide text-white"
                style={{
                  backgroundColor: config.color === "#FFFFFF" ? "rgba(0,0,0,0.85)" : config.color,
                  fontFamily: FONT_FAMILY_MAP[config.font as HighlightFontOption],
                }}
              >
                Caption preview
              </div>
            </div>
          )}
        </div>

        <div className="mt-0.5 flex h-1.5 items-center justify-center rounded-b-sm bg-zinc-800">
          <div className="h-0.5 w-4 rounded-full bg-zinc-700" />
        </div>
      </div>

      <p className="mt-2 text-[9px] text-zinc-600">Updates live</p>
      <div className="mx-auto mt-2 h-4 w-px bg-gradient-to-b from-zinc-700 to-transparent" />
      <p className="mt-1 text-[8px] leading-tight text-zinc-700">
        expands at
        <br />
        Step 4
      </p>
    </div>
  );
}
