import type { DemoClip } from "../../types";

// Fill in videoSrc and inputPath when real clips are chosen before the show.
// videoSrc: the URL the browser fetches, e.g. "/storage/downloads/clip1.mp4"
// inputPath: the path the backend uses, e.g. "backend/storage/downloads/clip1.mp4"
export const DEMO_CLIPS: DemoClip[] = [
  {
    title: "Insane clutch moment",
    streamer: "Clip 1",
    duration: "0:42",
    videoSrc: "",
    inputPath: "",
  },
  {
    title: "Unexpected reaction",
    streamer: "Clip 2",
    duration: "0:38",
    videoSrc: "",
    inputPath: "",
  },
  {
    title: "Highlight reel",
    streamer: "Clip 3",
    duration: "1:02",
    videoSrc: "",
    inputPath: "",
  },
];
