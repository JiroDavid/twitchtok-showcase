# AI Twitch Clip Editor

Convert landscape Twitch clips into vertical 9:16 short-form videos with AI-generated subtitles, smart crop detection, and social media metadata from a local web UI.

## Features

- **Twitch Integration**: log in with OAuth or paste any clip URL to download directly
- **Vertical Reformatting**: three layout modes: cropped, fullscreen, and stacked (facecam over gameplay)
- **AI Subtitles**: Whisper transcription with optional LLM refinement and profanity filtering
- **Smart Crop Detection**: Ollama vision model detects facecam and gameplay regions automatically
- **Metadata Generation**: AI-generated titles, hashtags, and summaries for YouTube/TikTok/Instagram
- **Live Caption Editor**: edit subtitles with a timeline preview before re-rendering
- **Crop Editor**: visually adjust AI-suggested crop boxes and re-render without re-transcribing

---

## Prerequisites

Install these before anything else.

### System Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Python 3.10+** | Backend runtime | [python.org](https://www.python.org/downloads/) |
| **Node.js 18+** | Frontend runtime | [nodejs.org](https://nodejs.org/) |
| **FFmpeg** | Video processing | See below |
| **Ollama** | Local LLM inference | [ollama.com](https://ollama.com/download) |

**FFmpeg:**
```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows: download from https://ffmpeg.org/download.html and add to PATH
```

### AI Models

You need to download three models before the app will work fully.

#### 1. Whisper (speech-to-text)

Whisper downloads automatically on first use. The app uses the `medium` model (~1.5 GB).

If you want to pre-download it:
```bash
pip install openai-whisper
python -c "import whisper; whisper.load_model('medium')"
```

> **Smaller/faster alternatives:** You can change `DEFAULT_WHISPER_MODEL` in `backend/app/services/transcription.py` to `"small"` (~500 MB) or `"base"` (~150 MB) if you need faster transcription at some quality cost.

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| `base` | ~150 MB | Fastest | Lower |
| `small` | ~500 MB | Fast | Good |
| `medium` | ~1.5 GB | Moderate | Better |
| `large` | ~3 GB | Slow | Best |

#### 2. Ollama Models (vision + text generation)

After installing Ollama, pull both models:

```bash
# Vision model: used for layout analysis and visual metadata notes
ollama pull llava-llama3:8b

# Text generation model: used for metadata (titles, hashtags, summaries) and subtitle refinement
ollama pull llama3.1:8b
```

> `llava-llama3:8b` is ~5 GB and `llama3.1:8b` is ~4.7 GB. Make sure Ollama is running (`ollama serve`) before starting the backend.

---

## Twitch App Setup

The app requires a Twitch application for OAuth login and the clips API.

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and click **Register Your Application**
2. Set **OAuth Redirect URL** to `http://localhost:8000/auth/twitch/callback`
3. Copy the **Client ID** and generate a **Client Secret**
4. Add them to `backend/.env` (see Configuration below)

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/your-username/ai-twitch-clip-editor.git
cd ai-twitch-clip-editor
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

---

## Configuration

### Backend — `backend/.env`

Create `backend/.env` (copy from the example below):

```env
APP_NAME=AI Twitch Clip Editor API
DEBUG=true
HOST=127.0.0.1
PORT=8000

# Twitch Developer App credentials
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:8000/auth/twitch/callback

# Frontend URL (where OAuth will redirect back to)
FRONTEND_URL=http://localhost:3000
```

### Frontend — `frontend/.env.local`

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running the App

You need three things running: Ollama, the backend, and the frontend.

### 1. Start Ollama

```bash
ollama serve
```

### 2. Start the backend

```bash
cd backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

### Getting clips

There are three ways to load a clip:

1. **Twitch Login** — click "Connect Twitch" to OAuth in and browse your recent clips
2. **Paste URL** — paste any `clips.twitch.tv` URL into the URL panel
3. **Re-process** — pick a previously downloaded `.mp4` from the downloaded files panel

### Processing a clip

1. Select a clip and click **Configure**
2. Choose your layout:
   - **Cropped** — center crop of the original video scaled to fill 9:16
   - **Fullscreen** — letterboxed/pillarboxed to fit 9:16 without cropping
   - **Stacked** — facecam on top, gameplay on bottom (AI detects regions automatically)
3. Configure subtitles (toggle, style, profanity filter, LLM refinement)
4. Configure metadata generation (title, hashtags, summary)
5. Click **Process** and watch the job panel for progress

### Editing subtitles

After processing, click **Edit Subtitles** to open the caption editor:
- Click any subtitle segment to edit the text
- Adjust timing with the timeline
- Change font, size, color, outline, and shadow
- Toggle profanity censoring
- Click **Re-render** to apply changes without re-transcribing

### Adjusting crop (Stacked layout)

Click **Edit Crop** to open the crop editor:
- The AI-suggested facecam and gameplay regions are shown
- Drag the handles to adjust
- Click **Re-render** to apply

### Outputs

Processed files are saved to `backend/storage/outputs/`:

| File | Description |
|------|-------------|
| `<slug>.mp4` | Final vertical video |
| `<slug>.srt` | Subtitles in SRT format |
| `<slug>.ass` | Subtitles in ASS format (styled) |
| `<slug>_metadata.json` | AI-generated titles, hashtags, summary |
| `<slug>_frame.jpg` | Representative frame used for vision analysis |

---

## ngrok Support (optional)

Everything runs locally by default. ngrok is only needed if Twitch OAuth refuses `localhost` as a redirect URI (some Twitch app configs require a public URL). The ngrok config is already present in the codebase but commented out.

To enable it:

1. Install ngrok and expose the backend:
   ```bash
   ngrok http 8000
   ```

2. Uncomment and update the ngrok lines in `backend/.env`:
   ```env
   TWITCH_REDIRECT_URI=https://your-subdomain.ngrok-free.app/auth/twitch/callback
   FRONTEND_URL=https://your-subdomain.ngrok-free.app
   ```

3. Uncomment the ngrok origin in `backend/app/main.py` (CORS allow list).

4. Uncomment the ngrok entry in `frontend/next.config.ts` (`allowedDevOrigins`).

5. Update the redirect URL in your Twitch Developer Console to match the ngrok URL.

To go back to local-only, re-comment those lines and set the Twitch console redirect back to `http://localhost:8000/auth/twitch/callback`.

---

## Project Structure

```
ai-twitch-clip-editor/
├── backend/
│   ├── app/
│   │   ├── core/config.py          # Settings (Pydantic)
│   │   ├── main.py                 # FastAPI app, CORS, static mounts
│   │   ├── routes/
│   │   │   ├── auth.py             # Twitch OAuth
│   │   │   ├── clips.py            # Clip download/resolve
│   │   │   └── jobs.py             # Job queue and status
│   │   ├── schemas/                # Pydantic request/response models
│   │   └── services/
│   │       ├── transcription.py    # Whisper speech-to-text
│   │       ├── video.py            # FFmpeg video processing
│   │       ├── layout_analysis.py  # Ollama vision — crop detection
│   │       ├── vision_analysis.py  # Ollama vision — frame notes
│   │       ├── metadata_generation.py  # Ollama LLM — titles/hashtags
│   │       ├── caption_refinement.py   # Ollama LLM — subtitle cleanup
│   │       ├── profanity_filter.py     # Regex-based word censoring
│   │       ├── twitch_api.py       # yt-dlp + Twitch Helix API
│   │       └── twitch_auth.py      # OAuth token exchange
│   ├── storage/
│   │   ├── downloads/              # Raw downloaded clips
│   │   ├── outputs/                # Processed videos and metadata
│   │   └── temp/                   # Temporary processing files
│   └── requirements.txt
└── frontend/
    ├── src/app/
    │   ├── page.tsx                # Main app state and layout
    │   ├── types.ts                # TypeScript interfaces
    │   ├── utils.ts                # Utility functions
    │   └── components/             # UI panels and modals
    ├── next.config.ts              # API proxy rewrites
    └── package.json
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, Uvicorn |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Speech-to-text | OpenAI Whisper |
| Vision & LLM | Ollama (`llava-llama3:8b`, `llama3.1:8b`) |
| Video processing | FFmpeg |
| Clip download | yt-dlp |
| Auth | Twitch OAuth2 |

---

## Troubleshooting

**Ollama models not responding**
Make sure `ollama serve` is running and the models are pulled:
```bash
ollama list    # should show llava-llama3:8b and llama3.1:8b
```

**Whisper is slow**
Switch to a smaller model in `backend/app/services/transcription.py`:
```python
DEFAULT_WHISPER_MODEL = "small"   # or "base"
```

**Twitch OAuth redirect fails**
- Confirm `TWITCH_REDIRECT_URI` in `.env` exactly matches what's registered in the Twitch Developer Console (including trailing slashes)
- For local development without ngrok, set the redirect URI to `http://localhost:8000/auth/twitch/callback`

**FFmpeg not found**
Verify FFmpeg is on your PATH:
```bash
ffmpeg -version
```
