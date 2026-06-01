"use client";

import { useEffect, useRef, useState } from "react";
import type { CropBox, DragMode, DragTarget, StackedConfig } from "../../types";

const DEFAULT_CROP: StackedConfig = {
  top_crop: { x: 0, y: 0, w: 1920, h: 540 },
  bottom_crop: { x: 0, y: 540, w: 1920, h: 540 },
  split_ratio_top: 0.5,
};

type VideoDimensions = { width: number; height: number };

type DragState = {
  target: DragTarget;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startBox: CropBox;
} | null;

function clampBox(box: CropBox, vw: number, vh: number): CropBox {
  const x = Math.max(0, Math.min(box.x, vw - box.w));
  const y = Math.max(0, Math.min(box.y, vh - box.h));
  const w = Math.max(80, Math.min(box.w, vw - x));
  const h = Math.max(80, Math.min(box.h, vh - y));
  return { x, y, w, h };
}

export function useDemoCropEditor(clipIndex: number | null, isOpen: boolean) {
  const [cropDraft, setCropDraft] = useState<StackedConfig>(DEFAULT_CROP);
  const [videoDim, setVideoDim] = useState<VideoDimensions>({ width: 1920, height: 1080 });

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<DragState>(null);

  // Load crop.json for the selected clip when editor opens
  useEffect(() => {
    if (!isOpen || clipIndex === null) return;
    fetch(`/demo_cache/clip${clipIndex + 1}/crop.json`)
      .then((r) => r.json())
      .then((data: StackedConfig) => setCropDraft(data))
      .catch(() => setCropDraft(DEFAULT_CROP));
  }, [isOpen, clipIndex]);

  // Global pointer move/up handlers for drag
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const container = previewContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // Video renders full-width h-auto inside container
      const renderedW = rect.width;
      const renderedH = renderedW * (videoDim.height / videoDim.width);
      const scaleX = videoDim.width / renderedW;
      const scaleY = videoDim.height / renderedH;

      const dx = (e.clientX - drag.startClientX) * scaleX;
      const dy = (e.clientY - drag.startClientY) * scaleY;
      const b = drag.startBox;

      let updated: CropBox;
      if (drag.mode === "move") {
        updated = clampBox({ ...b, x: b.x + dx, y: b.y + dy }, videoDim.width, videoDim.height);
      } else {
        updated = clampBox(
          { x: b.x, y: b.y, w: Math.max(80, b.w + dx), h: Math.max(80, b.h + dy) },
          videoDim.width,
          videoDim.height,
        );
      }

      setCropDraft((prev) =>
        drag.target === "top_crop"
          ? { ...prev, top_crop: updated }
          : { ...prev, bottom_crop: updated },
      );
    }

    function onPointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [videoDim]);

  function handleLoadedMetadata(video: HTMLVideoElement) {
    if (video.videoWidth > 0) {
      setVideoDim({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  function handleLoadedData(video: HTMLVideoElement) {
    if (video.videoWidth > 0) {
      setVideoDim({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  function handleStartDrag(
    e: React.PointerEvent,
    target: DragTarget,
    mode: DragMode,
  ) {
    e.preventDefault();
    const box = target === "top_crop" ? cropDraft.top_crop : cropDraft.bottom_crop;
    dragRef.current = {
      target,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...box },
    };
  }

  function handleUpdateSplitRatio(value: number) {
    setCropDraft((prev) => ({ ...prev, split_ratio_top: value }));
  }

  function boxToStyle(box: CropBox): React.CSSProperties {
    const { width, height } = videoDim;
    return {
      left: `${(box.x / width) * 100}%`,
      top: `${(box.y / height) * 100}%`,
      width: `${(box.w / width) * 100}%`,
      height: `${(box.h / height) * 100}%`,
    };
  }

  return {
    cropDraft,
    previewContainerRef,
    videoRef,
    topPreviewStyle: boxToStyle(cropDraft.top_crop),
    bottomPreviewStyle: boxToStyle(cropDraft.bottom_crop),
    onLoadedMetadata: handleLoadedMetadata,
    onLoadedData: handleLoadedData,
    onStartDrag: handleStartDrag,
    onUpdateSplitRatio: handleUpdateSplitRatio,
  };
}
