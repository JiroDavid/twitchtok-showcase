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
