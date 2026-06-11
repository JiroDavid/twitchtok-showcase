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
