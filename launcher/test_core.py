import os
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
        self.assertEqual(cmd[0], str(core.VENV_PYTHON))

    def test_frontend_command_is_npm_run_dev(self):
        cmd = core.frontend_command()
        self.assertTrue(cmd[0].startswith("npm"))
        self.assertEqual(cmd[1:], ["run", "dev"])


class HttpAliveTest(unittest.TestCase):
    def test_dead_port_is_not_alive(self):
        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        port = server.getsockname()[1]
        server.close()
        self.assertFalse(core.http_alive(f"http://127.0.0.1:{port}"))


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
        pid = proc.process.pid
        proc.stop()
        time.sleep(0.5)
        self.assertFalse(proc.is_running())
        self.assertFalse(proc.has_died())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)


if __name__ == "__main__":
    unittest.main()
