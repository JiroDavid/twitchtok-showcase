<div align="center">
  <img src="assets/logo.svg" width="160" height="160" alt="TwitchTok"/>

  <h1>TwitchTok</h1>

  <p>Convert Twitch clips into vertical short-form video with AI subtitles</p>

  [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](#)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
  [![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logoColor=white)](#)
  [![Whisper](https://img.shields.io/badge/Whisper-412991?style=for-the-badge&logo=openai&logoColor=white)](#)
  [![Twitch](https://img.shields.io/badge/Twitch-9146FF?style=for-the-badge&logo=twitch&logoColor=white)](#)

</div>

---

Convert landscape Twitch clips into vertical 9:16 short-form videos with AI-generated subtitles, smart crop detection, and social-media metadata. Includes an interactive demo website for live showcasing.

---

## Modes

### Demo mode (CCI Festival stand)

A polished landing page with 3 pre-loaded Twitch clips. Visitors pick a clip, configure the style, and watch the AI pipeline produce a captioned vertical video in real time. The slow AI steps (Whisper, crop detection) are pre-cached; only the FFmpeg subtitle burn-in runs live, so it's fast and reliable.

### Full pipeline mode

The `/app` route exposes the complete pipeline: Twitch OAuth login, paste-URL clip download, Whisper transcription, Ollama vision + LLM metadata generation, and the full editor UI.

---

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **Python 3.10+** | Backend runtime | [python.org](https://python.org/downloads/) |
| **Node.js 18+** | Frontend runtime | [nodejs.org](https://nodejs.org/) |
| **FFmpeg** | Video processing | `sudo apt install ffmpeg` / `brew install ffmpeg` |
| **Git LFS** | Large video file download | See below |

**Git LFS** must be installed before cloning or pulling, or the `.mp4` files will be stubs.

```bash
# Ubuntu / Debian / WSL
sudo apt install git-lfs

# macOS
brew install git-lfs

# Windows
winget install GitHub.GitLFS

# After installing, initialise once per machine:
git lfs install
```

### Full pipeline only

| Tool | Purpose |
|------|---------|
| **Ollama** | Local LLM inference for metadata + subtitle refinement |
| Twitch Developer App | OAuth login and clips API |

```bash
# Pull the required Ollama models after installing Ollama
ollama pull llava-llama3:8b   # vision: crop detection
ollama pull llama3.1:8b       # text: titles, hashtags, refinement
```

---

## Setup

There are two setup paths depending on the machine. Jump to the one that applies.

- [Windows (no WSL)](#windows-setup-no-wsl)
- [Linux / macOS / WSL](#linux-macos-wsl-setup)

---

## Windows setup (no WSL)

### Step 1 - Install prerequisites

Open **PowerShell as Administrator** and run:

```powershell
# Git (includes Git Bash and Git Credential Manager)
winget install Git.Git

# Git LFS - must be installed before cloning
winget install GitHub.GitLFS

# Python 3.11 (tick "Add python.exe to PATH" in the installer)
winget install Python.Python.3.11

# Node.js LTS
winget install OpenJS.NodeJS.LTS

# FFmpeg (adds ffmpeg to PATH automatically)
winget install Gyan.FFmpeg
```

Close and reopen PowerShell after these finish so the new PATH entries take effect.

Verify everything is on PATH:

```powershell
git --version
git lfs --version
python --version
node --version
ffmpeg -version
```

### Step 2 - Allow PowerShell scripts

Python virtual environments use `.ps1` activation scripts. Allow them to run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 3 - Clone the repo

```powershell
git lfs install
git clone https://github.com/JiroDavid/twitchtok-showcase.git
cd twitchtok-showcase
```

> If the HTTPS clone asks for credentials, sign in with your GitHub username and a Personal Access Token (not your password). Generate one at github.com/settings/tokens with `repo` scope.

### Step 4 - Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

No `.env` file is needed for demo mode.

### Step 5 - Frontend

```powershell
cd ..\frontend
npm install
```

### Step 6 - Run

Open **two separate PowerShell windows**, both from the repo root.

**Window 1 - backend:**

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Window 2 - frontend:**

```powershell
cd frontend
npm run dev
```

Open **http://localhost:3000** in a browser.

---

## Linux / macOS / WSL setup

### 1. Clone (with LFS)

```bash
git lfs install        # only needed once per machine
git clone git@github.com:JiroDavid/twitchtok-showcase.git
cd twitchtok-showcase
```

If you already cloned without LFS, fetch the video assets:

```bash
git lfs pull
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For **demo mode only**, no `.env` is needed. All settings have safe defaults and the backend starts without one.

For **full pipeline mode**, create `backend/.env`:

```env
APP_NAME=TwitchTok API
DEBUG=true
HOST=127.0.0.1
PORT=8000

TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:8000/auth/twitch/callback
FRONTEND_URL=http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Running (Linux / macOS / WSL)

Two terminals from the repo root:

```bash
# Terminal 1: backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2: frontend
cd frontend && npm run dev
```

Open **http://localhost:3000** - the demo landing page loads by default.

For the full pipeline, navigate to **http://localhost:3000/app**.

Windows users: see the [Windows setup](#windows-setup-no-wsl) section above which has the run commands in the correct PowerShell syntax.

---

## Demo landing page

The demo at `/` walks through 4 steps with auto-scroll:

1. **Pick a clip** - 3 pre-loaded Twitch highlights, hover to preview with audio
2. **Customise** - choose font, caption colour, and layout (Cropped / Fullscreen / Stacked). Each clip has a recommended layout badge.
3. **Processing** - animated AI step messages run while FFmpeg burns the captions in live. Holds on "Finishing up..." until the render actually completes.
4. **Reveal** - the finished captioned vertical clip plays in a phone frame. AI-generated TikTok title, description, and hashtags appear below.

### Pre-loaded clips

| # | Clip | Recommended layout |
|---|------|-------------------|
| 1 | Ludwig crashing out after losing a League of Legends tournament | Stacked |
| 2 | JasonTheWeen + Maya - Maya hands Jason a toad from her animal sanctuary | Cropped |
| 3 | Stable Ronaldo interviews Cyr (as Zorg) + Peach (as Leeloo Dallas) at the Streamer Awards | Fullscreen |

### Caption colours

The demo uses per-speaker caption colours baked into each clip's `captions.json`:
- Bottom track uses the colour picker selected by the visitor
- Top track speakers have fixed colours: pink for one speaker, orange for another where applicable

---

## Project structure

```
twitchtok-showcase/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app, CORS, static mounts
│   │   ├── routes/
│   │   │   ├── auth.py                 # Twitch OAuth
│   │   │   ├── clips.py                # Clip download and resolve
│   │   │   ├── demo.py                 # Demo cache endpoints (rerender, promote)
│   │   │   └── jobs.py                 # Job queue and status polling
│   │   └── services/
│   │       ├── transcription.py        # Whisper + ASS/SRT generation
│   │       ├── video.py                # FFmpeg video processing
│   │       ├── layout_analysis.py      # Ollama vision: crop detection
│   │       ├── metadata_generation.py  # Ollama LLM: titles/hashtags
│   │       └── caption_refinement.py   # Ollama LLM: subtitle cleanup
│   ├── storage/
│   │   ├── downloads/                  # clip{1,2,3}_cut.mp4 (LFS-tracked)
│   │   └── outputs/                    # Job outputs (gitignored)
│   └── requirements.txt
└── frontend/
    ├── public/
    │   ├── clips/                      # clip{1,2,3}_cut.mp4 (LFS-tracked, live preview)
    │   └── demo_cache/
    │       └── clip{1,2,3}/
    │           ├── base_{cropped,fullscreen,stacked}.mp4   # LFS-tracked, rerender inputs
    │           ├── output.mp4                              # LFS-tracked, reveal output
    │           └── captions.json                           # Caption timing + styles
    └── src/app/
        ├── page.tsx                    # Demo landing page
        ├── app/page.tsx                # Full pipeline UI
        ├── utils.ts                    # applyConfigToCaptions (per-speaker colour logic)
        └── components/demo/
            ├── ClipPicker.tsx          # Step 1: clip selection with audio preview
            ├── StyleConfigurator.tsx   # Step 2: font, colour, layout
            ├── ProcessingWindow.tsx    # Step 3: animated progress, waits for real render
            ├── RevealPanel.tsx         # Step 4: output video + AI metadata
            └── MiniPhonePreview.tsx    # Live phone preview during configuration
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Python, FastAPI, Uvicorn |
| Speech-to-text | faster-whisper |
| Vision + LLM | Ollama (`llava-llama3:8b`, `llama3.1:8b`) |
| Video processing | FFmpeg |
| Clip download | yt-dlp |
| Auth | Twitch OAuth2 |
| Large files | Git LFS |

---

## Troubleshooting

**Video files are tiny (a few hundred bytes)**
Git LFS wasn't installed before cloning. Run `git lfs install` then `git lfs pull`.

**Backend can't find clip files**
`backend/storage/downloads/clip{N}_cut.mp4` must exist. Run `git lfs pull` if missing.

**FFmpeg not found**
```bash
ffmpeg -version   # check it's on PATH
```
On Windows, close and reopen PowerShell after installing FFmpeg via winget.

**PowerShell blocks the venv activation script (Windows)**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**`python` not found (Windows)**
During the Python installer, tick "Add python.exe to PATH". If you already installed without it, re-run the installer and choose Modify, then tick that option.

**HTTPS clone asks for a password (Windows)**
GitHub no longer accepts account passwords for git operations. Use a Personal Access Token instead. Generate one at github.com/settings/tokens with `repo` scope and paste it as the password when prompted.

**Ollama models not responding** (full pipeline only)
```bash
ollama serve      # must be running
ollama list       # should show llava-llama3:8b and llama3.1:8b
```

**Twitch OAuth redirect fails** (full pipeline only)
Confirm `TWITCH_REDIRECT_URI` in `.env` exactly matches the redirect URI registered in the Twitch Developer Console.
