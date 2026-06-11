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
