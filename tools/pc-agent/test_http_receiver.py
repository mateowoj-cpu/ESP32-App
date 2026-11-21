#!/usr/bin/env python3
"""HTTP receiver test for the canonical PC agent.

Starts a local POST /api/pc-stats server, runs esp32_pc_agent.py --once against it,
asserts JSON fields (cpu/ram/gpu/disk) and a successful agent exit code.
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Optional

AGENT = Path(__file__).resolve().parent / "esp32_pc_agent.py"


class Receiver:
    def __init__(self) -> None:
        self.payload: Optional[dict[str, Any]] = None
        self.error: Optional[str] = None
        self._event = threading.Event()

    def mark(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self._event.set()

    def fail(self, message: str) -> None:
        self.error = message
        self._event.set()

    def wait(self, timeout: float) -> bool:
        return self._event.wait(timeout)


def make_handler(receiver: Receiver):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            return

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/api/pc-stats":
                self.send_response(404)
                self.end_headers()
                receiver.fail(f"unexpected path: {self.path}")
                return
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except Exception as exc:  # pragma: no cover
                self.send_response(400)
                self.end_headers()
                receiver.fail(f"invalid JSON: {exc}")
                return
            if not isinstance(payload, dict):
                self.send_response(400)
                self.end_headers()
                receiver.fail("payload is not an object")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            receiver.mark(payload)

    return Handler


def assert_percent(payload: dict[str, Any], key: str) -> None:
    if key not in payload:
        raise AssertionError(f"missing field: {key}")
    value = payload[key]
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise AssertionError(f"{key} must be a number, got {type(value).__name__}: {value!r}")
    if value < 0 or value > 100:
        raise AssertionError(f"{key} out of range 0..100: {value}")


def main() -> int:
    if not AGENT.is_file():
        print(f"missing agent source: {AGENT}", file=sys.stderr)
        return 2

    receiver = Receiver()
    server = HTTPServer(("127.0.0.1", 0), make_handler(receiver))
    port = int(server.server_address[1])
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        completed = subprocess.run(
            [
                sys.executable,
                str(AGENT),
                "--once",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--no-gpu",
                "--timeout",
                "3",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired:
        server.shutdown()
        print("agent timed out", file=sys.stderr)
        return 1

    server.shutdown()

    if completed.returncode != 0:
        print("agent exit code:", completed.returncode, file=sys.stderr)
        print(completed.stdout, file=sys.stderr)
        print(completed.stderr, file=sys.stderr)
        return completed.returncode or 1

    if not receiver.wait(2.0):
        print("receiver did not get a POST", file=sys.stderr)
        print(completed.stdout, file=sys.stderr)
        print(completed.stderr, file=sys.stderr)
        return 1

    if receiver.error:
        print(receiver.error, file=sys.stderr)
        return 1

    payload = receiver.payload or {}
    try:
        for key in ("cpu", "ram", "gpu", "disk"):
            assert_percent(payload, key)
        if payload["gpu"] != 0:
            raise AssertionError(f"expected gpu=0 with --no-gpu, got {payload['gpu']}")
    except AssertionError as exc:
        print(f"payload assertion failed: {exc}", file=sys.stderr)
        print("payload:", payload, file=sys.stderr)
        return 1

    print(
        "pc-agent HTTP receiver OK:",
        f"cpu={payload['cpu']} ram={payload['ram']} "
        f"gpu={payload['gpu']} disk={payload['disk']} exit={completed.returncode}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
