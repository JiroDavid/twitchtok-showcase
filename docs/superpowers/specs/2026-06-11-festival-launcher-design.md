# Festival Launcher - Design

Date: 2026-06-11
Status: Approved

## Purpose

A control panel for running the TwitchTok showcase demo on university Windows PCs at the
CCI Summer Festival. One window to set up, start, stop, and monitor the backend (FastAPI)
and frontend (Next.js), with logs that can be copied in one click for troubleshooting.

Assumption: the festival PCs have enough admin access to install prerequisites and run
the app. The developer's laptop is not the host machine.

## Files

```
launcher.bat            Double-click entry point. Finds Python, opens the launcher window.
install-prereqs.bat     Right-click "Run as administrator" on a fresh PC. winget installs.
launcher/launcher.py    The control panel. Python stdlib only (tkinter, subprocess,
                        threading, urllib).
launcher/logs/          Timestamped log files. Gitignored.
```

## Window layout

Three zones, top to bottom:

1. **Toolbar** - buttons: `Setup`, `Start Both`, `Start Backend`, `Start Frontend`,
   `Stop All`, `Open Demo` (opens browser at http://localhost:3000), `Copy All Logs`.
2. **Status row** - one dot per server. Grey = stopped, yellow = starting,
   green = HTTP responding, red = process died. A background thread polls
   `http://127.0.0.1:8000` and `http://127.0.0.1:3000` every 3 seconds.
3. **Log pane** - single scrollable read-only text widget. Every line is prefixed
   `[backend]`, `[frontend]`, or `[launcher]` and colour-tagged by source. All lines are
   mirrored to files in `launcher/logs/` with timestamps. `Copy All Logs` places the whole
   buffer on the clipboard.

## Process management

- Backend command: `backend\.venv\Scripts\python.exe -m uvicorn app.main:app
  --host 127.0.0.1 --port 8000`, cwd `backend/`. No `--reload`: code is not edited at the
  stand and reload's child process makes clean shutdown unreliable on Windows.
- Frontend command: `npm run dev`, cwd `frontend/` (via `npm.cmd` on Windows).
- stdout/stderr of each child are piped; a reader thread per stream pushes lines onto a
  queue; the Tk main loop drains the queue into the log pane on a 100 ms timer.
- Stop kills the full process tree (`taskkill /T /F /PID` on Windows) because npm spawns
  child Node processes that would otherwise survive and hold port 3000. On POSIX (dev
  testing under WSL), use process groups and `killpg` instead.
- Closing the window stops both servers first (WM_DELETE_WINDOW handler).
- Pre-start check: if the target port is already in use, log a clear message and do not
  start the process.

## Setup button

Runs in a worker thread, streaming each step's output into the log pane, in order:

1. Report Python version in use.
2. Create `backend/.venv` if missing.
3. `pip install -r requirements.txt` (backend).
4. `npm install` (frontend).
5. Verify `ffmpeg`, `node`, and `git lfs` are on PATH.
6. Verify one demo `.mp4` is a real video rather than an un-pulled Git LFS pointer stub
   (read the first bytes and reject the `version https://git-lfs` text signature).

Each failed step reports the exact command that fixes it. Buttons that conflict with a
running setup are disabled while it runs.

## install-prereqs.bat

Mirrors the README Windows section: winget installs of Git, Git LFS, Python 3.11,
Node.js LTS, FFmpeg, then `git lfs install`. Exists because the launcher cannot install
Python for itself.

## Error handling

- Every subprocess failure surfaces in the log pane with a `[launcher]` line stating what
  failed and what to try.
- The status dots distinguish "process running but HTTP not up yet" (yellow) from
  "process exited" (red) so a crash during the festival is visible at a glance.

## Out of scope

- Ollama / full pipeline management.
- Auto-restart on crash.
- Any dependency outside the Python standard library.
- Compiled .exe packaging (university antivirus risk, no on-site editability).

## Testing

- Logic developed and smoke-tested under WSL (tkinter via WSLg, POSIX process-group path).
- Real validation on a university Windows PC during the test visit on 2026-06-12:
  fresh-machine flow is install-prereqs.bat, then launcher.bat, then Setup, then Start Both.
