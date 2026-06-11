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
        process.stdout.close()
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
            except (ProcessLookupError, PermissionError):
                pass
        self.process = None
