FULL CONTEXT DROP — AI-Assisted Twitch Clip Editor Dissertation
1. Project Overview

I am building a full-stack web application for my Computer Science dissertation.

The project is an AI-assisted Twitch clip editor designed to convert Twitch clips into short-form vertical content (TikTok, YouTube Shorts, Instagram Reels).

The core idea is:

Traditional editing is slow and manual
AI can automate parts of the workflow
This project evaluates whether AI actually improves efficiency and usability

So this is both a software system AND a research experiment

2. Core Research Goal

The project is not just to build features — it is to evaluate the impact of AI on the editing workflow

Research Direction

Compare:

AI-assisted editing
vs
Manual editing (no AI)
High-Level Research Question

Does AI-assisted video editing improve efficiency and user experience compared to traditional manual editing tools?

Hypothesis (implied)
AI reduces time taken
AI improves perceived usability
AI reduces effort, but may reduce control
3. System Architecture
Backend
Framework: FastAPI (Python)

Structure:

backend/app/
  core/
  routes/
    auth.py
    clips.py
    jobs.py
  schemas/
  services/
    twitch_api.py
    twitch_auth.py
    video.py
    jobs.py
    transcription.py
backend/storage/
  downloads/
  outputs/
  temp/
Frontend
Framework: Next.js (React)
Modular component structure:
AccountPanel
EditorControlsPanel
JobActivityPanel
TwitchClipsPanel
TwitchUrlPanel
DownloadedFilesPanel
OutputPreviewPanel
CropEditorModal
SubtitleEditorModal
4. Current System Features (IMPLEMENTED)
Clip Ingestion
Twitch OAuth integration
Fetch clips via Helix API
Manual Twitch clip URL input
Clip downloading using yt-dlp
Job System
In-memory background jobs
Status tracking:
queued
processing
completed
failed
Video Processing (FFmpeg Pipeline)

Supports 3 vertical layouts:

1. Cropped
Center crop to 9:16
2. Fullscreen
Blurred background
Foreground centered
3. Stacked
Facecam + gameplay layout
Manual crop selection supported
Subtitle System (AI-Assisted)
Transcription
Uses Whisper
Forces English
Uses word-level timestamps
Caption Processing
Chunked into subtitle segments
Smart splitting (based on punctuation)
Output Formats
captions.json → source of truth (editable)
SRT → intermediate
ASS → styled subtitles (final render)
Rendering
FFmpeg burn-in subtitles
Second-pass render for captions
Subtitle Editing (Frontend)
Modal-based editor
Edit:
text
timing
positioning (top/bottom tracks)
styling (font size, color)
Supports:
multiple simultaneous captions (~2–3 tracks)
rerender pipeline using updated captions.json
Preview System
Displays processed videos
Cache-busting implemented (unique filenames)
5. Key Design Decision

AI output is NOT final.

Subtitles and AI-generated content are treated as editable drafts, not locked results.

This ensures:

User control
Flexibility
Better UX for creators
6. Current Limitations / Issues
Subtitles
Font size too small (~140 preferred)
Outline/stroke too weak
No shadow control
Timing input UX is buggy (resets to 0)
No timeline editor (currently form-based)
UX Issues
Subtitle editor needs better interaction model
Multi-caption editing works but is clunky
Preview layout diagrams are basic (being improved)
Stacked Layout (IMPORTANT)
Currently requires manual crop selection
This introduces friction
This is a key area for AI improvement
7. New System Direction (IMPORTANT SHIFT)

The project is now research-driven first, not feature-driven.

Two Modes Must Exist
1. AI Mode

Includes:

Whisper (subtitles)
Future:
LLaVA / Ollama (layout decisions, detection)
Goal:
automate editing steps
reduce effort/time
2. Non-AI Mode

Includes:

FFmpeg only
Manual crop editor
Manual subtitle editing
Purpose

To create a fair comparison environment for user testing

8. User Testing Plan (FINALIZED)
Testing Structure (Repeatable)
Introduction + demo (few minutes)
Consent form (university template)
Task execution
Data collection
Tasks

Users will:

Edit a clip using Non-AI mode
Edit a clip using AI mode
Quantitative Data

Collected via:

Time to complete tasks
Surveys (Codetta platform):
demographics
usability (e.g. GEQ, RiCEv2-style)

Processing:

Export to Excel
Analyze in Jupyter Notebook
Use matplotlib for graphs
Qualitative Data

Collected via:

Retrospective think-aloud OR
Short structured interviews

Focus:

Ease of use
Preference
Frustrations
Perceived efficiency
9. Next Critical Development Task
AI-Assisted Stacked Layout Automation

Goal:

Remove need for manual cropping
Automatically detect:
facecam region
gameplay region

Possible approaches:

Vision model (LLaVA)
Heuristics (face detection, motion regions)

Requirements:

Must work fast enough for UX
Must fall back to manual editor if incorrect
10. Constraints (VERY IMPORTANT)
Do NOT over-engineer AI features
Every feature must support:
→ research question (efficiency/usability)
System must remain:
stable
testable
comparable between modes
11. Development Style Required

Claude should act as a technical dev partner, not a generic assistant.

Required Behavior
Ask for current files before suggesting changes
Provide:
exact file edits
full code (not snippets unless small)
where to place code
Include:
restart instructions
test steps (API/UI)
expected outputs
Workflow Discipline

Always remind:

git status
git add .
git commit (with proper message + body)
git push
12. Immediate Next Step

Claude should begin by asking for:

Full file tree
backend/app/services/video.py
backend/app/services/transcription.py
backend/app/routes/jobs.py
frontend subtitle editor files

Then proceed with ONE of:

AI stacked layout automation (priority)
Subtitle UX improvements (secondary)
13. Optional (If Continuing Dissertation Writing)

Claude can also help with:

Research question refinement
Methodology section writing
Evaluation design justification
Results analysis structure
14. Key Philosophy of the Project

This is not:

“build the smartest AI editor”

This IS:

“Evaluate whether AI meaningfully improves the editing workflow in a measurable, user-tested way”