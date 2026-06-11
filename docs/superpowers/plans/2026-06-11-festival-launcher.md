# Festival Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A double-clickable Windows control panel that sets up, starts, stops, and monitors the TwitchTok demo backend and frontend, with one-click log copying.

**Architecture:** `launcher/core.py` holds all process management and environment checks (no GUI imports, unit-testable headless). `launcher/launcher.py` is the tkinter window that wires buttons to core. Two batch files cover bootstrap: `install-prereqs.bat` (winget installs, run as admin once per machine) and `launcher.bat` (finds Python, opens the window).

**Tech Stack:** Python stdlib only (tkinter, subprocess, threading, queue, urllib, socket). Windows batch. No new pip or npm dependencies.

**Spec:** `docs/superpowers/specs/2026-06-11-festival-launcher-design.md`. One deliberate refinement: logic is split into `core.py` so it can be tested without tkinter/a display; the spec's single-file `launcher.py` becomes the GUI layer only.

**Working directory:** repo root `/home/jirod/repos/twitchtok-showcase` unless a step says otherwise. Tests run with the system `python3` (no venv needed, stdlib only).

---

### Task 1: Core helpers (paths, commands, port and LFS checks)

**Files:**
- Create: `launcher/core.py`
- Test: `launcher/test_core.py`

- [ ] **Step 1: Write the failing tests**

Create `launcher/test_core.py`:

```python
import queue
import socket
import sys
import tempfile
import time
import unittest
from pathlib import Path

import core


class IsLfsPointerTest(unittest.TestCase):
    def test_detects_pointer_stub(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f:
            f.write(b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\n")
        self.assertTrue(core.is_lfs_pointer(f.name))

    def test_real_binary_is_not_pointer(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42")
        self.assertFalse(core.is_lfs_pointer(f.name))

    def test_missing_file_is_not_pointer(self):
        self.assertFalse(core.is_lfs_pointer("/nonexistent/file.mp4"))


class PortInUseTest(unittest.TestCase):
    def test_listening_port_is_detected(self):
        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        port = server.getsockname()[1]
        try:
            self.assertTrue(core.port_in_use(port))
        finally:
            server.close()

    def test_closed_port_is_free(self):
        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        port = server.getsockname()[1]
        server.close()
        self.assertFalse(core.port_in_use(port))


class CommandTest(unittest.TestCase):
    def test_backend_command_runs_uvicorn_on_8000(self):
        cmd = core.backend_command()
        self.assertIn("uvicorn", cmd)
        self.assertIn("app.main:app", cmd)
        self.assertIn("8000", cmd)
        self.assertIn(".venv", cmd[0])

    def test_frontend_command_is_npm_run_dev(self):
        cmd = core.frontend_command()
        self.assertTrue(cmd[0].startswith("npm"))
        self.assertEqual(cmd[1:], ["run", "dev"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd launcher && python3 -m unittest test_core -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core'`

- [ ] **Step 3: Write the helpers**

Create `launcher/core.py`:

```python
import os
import signal
import socket
import subprocess
import threading
from pathlib import Path
from urllib.request import urlopen

IS_WINDOWS = os.name == "nt"
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"
LOGS_DIR = REPO_ROOT / "launcher" / "logs"

VENV_DIR = BACKEND_DIR / ".venv"
VENV_PYTHON = VENV_DIR / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
NPM = "npm.cmd" if IS_WINDOWS else "npm"

BACKEND_PORT = 8000
FRONTEND_PORT = 3000
BACKEND_URL = "http://127.0.0.1:8000/docs"
FRONTEND_URL = "http://127.0.0.1:3000"
LFS_CHECK_FILE = REPO_ROOT / "frontend" / "public" / "demo_cache" / "clip1" / "output.mp4"

LFS_POINTER_SIG = b"version https://git-lfs"


def backend_command():
    return [
        str(VENV_PYTHON), "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1", "--port", str(BACKEND_PORT),
    ]


def frontend_command():
    return [NPM, "run", "dev"]


def is_lfs_pointer(path):
    try:
        with open(path, "rb") as f:
            return f.read(len(LFS_POINTER_SIG)) == LFS_POINTER_SIG
    except OSError:
        return False


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def http_alive(url):
    try:
        with urlopen(url, timeout=2):
            return True
    except Exception:
        return False
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd launcher && python3 -m unittest test_core -v`
Expected: 7 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add launcher/core.py launcher/test_core.py
git commit -m "feat: launcher core helpers (commands, port, LFS stub check)"
```

---

### Task 2: ManagedProcess (start, stream logs, kill process tree)

**Files:**
- Modify: `launcher/core.py` (append class)
- Test: `launcher/test_core.py` (append test class)

- [ ] **Step 1: Write the failing test**

Append to `launcher/test_core.py` (above the `if __name__` block):

```python
class ManagedProcessTest(unittest.TestCase):
    def test_streams_output_and_stops(self):
        log_queue = queue.Queue()
        child = [sys.executable, "-u", "-c",
                 "import time; print('hello from child'); time.sleep(30)"]
        proc = core.ManagedProcess("child", lambda: child, Path.cwd(), 65123, log_queue)
        proc.start()
        lines = []
        deadline = time.time() + 10
        while time.time() < deadline and not any("hello from child" in l for _, l in lines):
            try:
                lines.append(log_queue.get(timeout=0.5))
            except queue.Empty:
                pass
        self.assertTrue(any("hello from child" in l for _, l in lines))
        self.assertTrue(proc.is_running())
        proc.stop()
        time.sleep(0.5)
        self.assertFalse(proc.is_running())
        self.assertFalse(proc.has_died())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd launcher && python3 -m unittest test_core.ManagedProcessTest -v`
Expected: FAIL with `AttributeError: module 'core' has no attribute 'ManagedProcess'`

- [ ] **Step 3: Implement ManagedProcess**

Append to `launcher/core.py`:

```python
class ManagedProcess:
    """Wraps one server process. stdout/stderr lines land on log_queue as
    (name, line) tuples. stop() kills the whole tree: npm spawns child node
    processes that would otherwise survive and keep the port busy."""

    def __init__(self, name, command_factory, cwd, port, log_queue):
        self.name = name
        self.command_factory = command_factory
        self.cwd = cwd
        self.port = port
        self.log_queue = log_queue
        self.process = None

    def is_running(self):
        return self.process is not None and self.process.poll() is None

    def has_died(self):
        return self.process is not None and self.process.poll() is not None

    def start(self):
        if self.is_running():
            self.log_queue.put(("launcher", f"{self.name} is already running"))
            return
        if port_in_use(self.port):
            self.log_queue.put((
                "launcher",
                f"port {self.port} is already in use, not starting {self.name}. "
                f"Close whatever is using it (or reboot) and try again.",
            ))
            return
        kwargs = {}
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        try:
            self.process = subprocess.Popen(
                self.command_factory(), cwd=str(self.cwd),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace", **kwargs,
            )
        except OSError as exc:
            self.process = None
            self.log_queue.put(("launcher", f"failed to start {self.name}: {exc}"))
            return
        self.log_queue.put(("launcher", f"{self.name} starting (pid {self.process.pid})"))
        threading.Thread(target=self._pump, args=(self.process,), daemon=True).start()

    def _pump(self, process):
        for line in process.stdout:
            self.log_queue.put((self.name, line.rstrip("\n")))
        code = process.wait()
        self.log_queue.put(("launcher", f"{self.name} exited with code {code}"))

    def stop(self):
        if not self.is_running():
            self.process = None
            return
        pid = self.process.pid
        self.log_queue.put(("launcher", f"stopping {self.name} (pid {pid})"))
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)],
                           capture_output=True)
        else:
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        self.process = None
```

Note: `self.process = None` at the end of `stop()` is what distinguishes a deliberate stop (grey dot) from a crash (`has_died()`, red dot).

- [ ] **Step 4: Run all tests to verify they pass**

Run: `cd launcher && python3 -m unittest test_core -v`
Expected: 8 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add launcher/core.py launcher/test_core.py
git commit -m "feat: launcher ManagedProcess with tree kill and log streaming"
```

---

### Task 3: tkinter control panel

**Files:**
- Create: `launcher/launcher.py`

No automated test (GUI). Verification is a manual smoke run in Step 2.

- [ ] **Step 1: Write the GUI**

Create `launcher/launcher.py`:

```python
import queue
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime

import tkinter as tk
from tkinter import scrolledtext

import core

SOURCE_COLOURS = {
    "backend": "#7ec8ff",
    "frontend": "#9dff9d",
    "launcher": "#ffd27e",
}

STATE_COLOURS = {
    "running": "#2e9e2e",
    "starting": "#c8a200",
    "died - check logs": "#cc3333",
    "stopped": "grey",
}

SERVER_BUTTONS = ("Setup", "Start Both", "Start Backend", "Start Frontend")


class LauncherApp(tk.Tk):
    DRAIN_MS = 100
    STATUS_MS = 500

    def __init__(self):
        super().__init__()
        self.title("TwitchTok Festival Launcher")
        self.geometry("980x620")
        self.log_queue = queue.Queue()
        self.health = {"backend": False, "frontend": False}
        self.busy = False
        self.backend = core.ManagedProcess(
            "backend", core.backend_command, core.BACKEND_DIR,
            core.BACKEND_PORT, self.log_queue)
        self.frontend = core.ManagedProcess(
            "frontend", core.frontend_command, core.FRONTEND_DIR,
            core.FRONTEND_PORT, self.log_queue)
        core.LOGS_DIR.mkdir(parents=True, exist_ok=True)
        log_name = datetime.now().strftime("session_%Y%m%d_%H%M%S.log")
        self.log_file = open(core.LOGS_DIR / log_name, "a", encoding="utf-8")
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(self.DRAIN_MS, self._drain_logs)
        self.after(self.STATUS_MS, self._refresh_status)
        threading.Thread(target=self._poll_health, daemon=True).start()
        self.log("launcher", f"repo: {core.REPO_ROOT}")
        self.log("launcher", "Setup installs dependencies. Start Both runs the demo. "
                             "Copy All Logs puts everything on the clipboard.")

    def _build_ui(self):
        toolbar = tk.Frame(self)
        toolbar.pack(fill="x", padx=8, pady=6)
        self.buttons = {}
        for label, command in (
            ("Setup", self.on_setup),
            ("Start Both", self.on_start_both),
            ("Start Backend", self.backend.start),
            ("Start Frontend", self.frontend.start),
            ("Stop All", self.on_stop_all),
            ("Open Demo", lambda: webbrowser.open(core.FRONTEND_URL)),
            ("Copy All Logs", self.on_copy_logs),
        ):
            button = tk.Button(toolbar, text=label, command=command)
            button.pack(side="left", padx=3)
            self.buttons[label] = button

        status_row = tk.Frame(self)
        status_row.pack(fill="x", padx=10)
        self.status_labels = {}
        for name in ("backend", "frontend"):
            label = tk.Label(status_row, text=f"● {name}: stopped",
                             fg="grey", font=("TkDefaultFont", 10, "bold"))
            label.pack(side="left", padx=12)
            self.status_labels[name] = label

        self.log_view = scrolledtext.ScrolledText(
            self, state="disabled", wrap="word", bg="#101010", fg="#dddddd")
        self.log_view.pack(fill="both", expand=True, padx=8, pady=8)
        for tag, colour in SOURCE_COLOURS.items():
            self.log_view.tag_configure(tag, foreground=colour)

    def log(self, source, line):
        self.log_queue.put((source, line))

    def _drain_logs(self):
        lines = []
        try:
            while True:
                lines.append(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        if lines:
            self.log_view.configure(state="normal")
            for source, line in lines:
                stamp = datetime.now().strftime("%H:%M:%S")
                entry = f"[{stamp}] [{source}] {line}\n"
                self.log_view.insert("end", entry, source)
                self.log_file.write(entry)
            self.log_file.flush()
            self.log_view.see("end")
            self.log_view.configure(state="disabled")
        self.after(self.DRAIN_MS, self._drain_logs)

    def _poll_health(self):
        while True:
            self.health = {
                "backend": core.http_alive(core.BACKEND_URL),
                "frontend": core.http_alive(core.FRONTEND_URL),
            }
            time.sleep(3)

    def _refresh_status(self):
        for name, proc in (("backend", self.backend), ("frontend", self.frontend)):
            if proc.is_running():
                state = "running" if self.health.get(name) else "starting"
            elif proc.has_died():
                state = "died - check logs"
            else:
                state = "stopped"
            self.status_labels[name].configure(
                text=f"● {name}: {state}", fg=STATE_COLOURS[state])
        self.after(self.STATUS_MS, self._refresh_status)

    def on_start_both(self):
        self.backend.start()
        self.frontend.start()

    def on_stop_all(self):
        self.frontend.stop()
        self.backend.stop()

    def on_copy_logs(self):
        text = self.log_view.get("1.0", "end-1c")
        self.clipboard_clear()
        self.clipboard_append(text)
        self.log("launcher", f"copied {len(text.splitlines())} log lines to clipboard")

    def on_setup(self):
        if self.busy:
            self.log("launcher", "setup is already running")
            return
        self.busy = True
        for label in SERVER_BUTTONS:
            self.buttons[label].configure(state="disabled")
        threading.Thread(target=self._setup_worker, daemon=True).start()

    def _run_step(self, description, command, cwd):
        self.log("launcher", f"setup: {description}")
        try:
            process = subprocess.Popen(
                command, cwd=str(cwd),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace")
        except OSError as exc:
            self.log("launcher", f"setup: {description} FAILED to start: {exc}")
            return False
        for line in process.stdout:
            self.log("launcher", line.rstrip("\n"))
        if process.wait() != 0:
            self.log("launcher",
                     f"setup: {description} FAILED (exit code {process.returncode})")
            return False
        return True

    def _setup_worker(self):
        try:
            ok = True
            self.log("launcher",
                     f"setup: launcher Python is {sys.version.split()[0]} ({sys.executable})")
            if not core.VENV_PYTHON.exists():
                ok &= self._run_step(
                    "creating backend/.venv",
                    [sys.executable, "-m", "venv", str(core.VENV_DIR)],
                    core.BACKEND_DIR)
            if core.VENV_PYTHON.exists():
                ok &= self._run_step(
                    "pip install -r requirements.txt",
                    [str(core.VENV_PYTHON), "-m", "pip", "install",
                     "-r", "requirements.txt"],
                    core.BACKEND_DIR)
            else:
                ok = False
            ok &= self._run_step("npm install", [core.NPM, "install"], core.FRONTEND_DIR)
            for tool, fix in (
                ("ffmpeg", "winget install Gyan.FFmpeg"),
                ("node", "winget install OpenJS.NodeJS.LTS"),
            ):
                if shutil.which(tool) is None:
                    self.log("launcher",
                             f"setup: MISSING {tool} - install with: {fix}, "
                             f"then close and reopen the launcher")
                    ok = False
            lfs = subprocess.run(["git", "lfs", "version"], capture_output=True)
            if lfs.returncode != 0:
                self.log("launcher",
                         "setup: MISSING git lfs - install with: winget install GitHub.GitLFS")
                ok = False
            if not core.LFS_CHECK_FILE.exists():
                self.log("launcher",
                         f"setup: demo cache file missing: {core.LFS_CHECK_FILE}")
                ok = False
            elif core.is_lfs_pointer(core.LFS_CHECK_FILE):
                self.log("launcher",
                         "setup: demo videos are un-pulled LFS stubs - "
                         "run: git lfs install, then: git lfs pull")
                ok = False
            self.log("launcher",
                     "setup: ALL CHECKS PASSED - press Start Both" if ok
                     else "setup: finished with problems, see the lines above")
        finally:
            self.busy = False
            self.after(0, self._enable_buttons)

    def _enable_buttons(self):
        for label in SERVER_BUTTONS:
            self.buttons[label].configure(state="normal")

    def _on_close(self):
        self.on_stop_all()
        self.log_file.close()
        self.destroy()


def main():
    app = LauncherApp()
    app.mainloop()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Manual smoke test under WSL**

WSLg provides a display in WSL2 on Windows 11. If `python3 -c "import tkinter"` fails, first run `sudo apt install python3-tk`.

Run: `python3 launcher/launcher.py`

Verify:
1. Window opens with toolbar, two grey status dots, dark log pane showing the repo path.
2. Press Start Backend: backend dot goes yellow then green within ~5s, uvicorn lines appear in blue.
3. Press Start Frontend: frontend dot goes green, Next.js lines appear in green.
4. Press Open Demo: browser opens localhost:3000.
5. Press Copy All Logs: paste somewhere, full log appears.
6. Press Stop All: both dots return to grey, ports 8000/3000 freed (`curl -s localhost:8000` fails).
7. Start backend, then `kill -9` the uvicorn pid from another terminal: dot goes red "died - check logs".
8. Close window with servers running: processes are gone afterwards.
9. Check `launcher/logs/` contains a timestamped session log mirroring the pane.

- [ ] **Step 3: Commit**

```bash
git add launcher/launcher.py
git commit -m "feat: tkinter festival launcher window"
```

---

### Task 4: Batch files, gitignore, gitattributes

**Files:**
- Create: `launcher.bat`
- Create: `install-prereqs.bat`
- Modify: `.gitignore` (append)
- Modify: `.gitattributes` (append)

- [ ] **Step 1: Create launcher.bat**

```bat
@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 launcher\launcher.py
) else (
    python launcher\launcher.py
)
if errorlevel 1 (
    echo.
    echo Launcher exited with an error.
    echo If Python is missing, run install-prereqs.bat first - right-click,
    echo "Run as administrator" - then open a new window and try again.
    pause
)
```

- [ ] **Step 2: Create install-prereqs.bat**

```bat
@echo off
echo === TwitchTok prerequisites installer ===
echo Installs Git, Git LFS, Python 3.11, Node.js LTS and FFmpeg via winget.
echo.

net session >nul 2>nul
if not %errorlevel%==0 (
    echo Please right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id GitHub.GitLFS -e --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements

echo.
echo Done. Open a NEW terminal so PATH updates apply, then run: git lfs install
echo After that, double-click launcher.bat and press Setup.
pause
```

- [ ] **Step 3: Append to .gitignore**

```
launcher/logs/
```

- [ ] **Step 4: Append to .gitattributes**

Batch files must keep CRLF endings or cmd.exe mis-parses labels and multi-line blocks:

```
*.bat text eol=crlf
```

- [ ] **Step 5: Verify batch syntax visually and check git state**

Run: `git status --short`
Expected: only the four intended files listed. Run `file launcher.bat` and confirm it reports CRLF line terminators; if not, run `unix2dos launcher.bat install-prereqs.bat` (or rewrite the files with CRLF endings).

- [ ] **Step 6: Commit**

```bash
git add launcher.bat install-prereqs.bat .gitignore .gitattributes
git commit -m "feat: festival launcher entry points and prereq installer"
```

---

### Task 5: README section

**Files:**
- Modify: `README.md` (add a short section after the Windows setup section)

- [ ] **Step 1: Add the section**

Insert after the existing Windows setup section (find it with `grep -n "Windows setup" README.md`):

```markdown
## Festival launcher (Windows)

For demo machines there is a one-window control panel instead of two PowerShell windows:

1. On a fresh PC: right-click `install-prereqs.bat`, choose "Run as administrator",
   then open a new terminal and run `git lfs install`.
2. Double-click `launcher.bat`.
3. Press **Setup** once (creates the venv, installs Python and npm dependencies,
   verifies FFmpeg, Node, Git LFS and the demo videos).
4. Press **Start Both**, wait for both status dots to turn green, then **Open Demo**.

The log pane shows both servers. **Copy All Logs** puts everything on the clipboard
for troubleshooting. Logs are also written to `launcher/logs/`.
```

- [ ] **Step 2: Run the full test suite one last time**

Run: `cd launcher && python3 -m unittest test_core -v`
Expected: 8 tests, all PASS

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: festival launcher usage"
```
