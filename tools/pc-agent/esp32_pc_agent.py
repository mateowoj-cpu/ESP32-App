#!/usr/bin/env python3
"""
ESP32 Display Studio — PC resource agent.

Sends CPU / RAM / disk / (optional) GPU usage to the ESP32 HTTP endpoint:
  POST http://<esp32-ip>:<port>/api/pc-stats
  {"cpu": 12, "ram": 45, "gpu": 0, "disk": 64}

Usage:
  python esp32_pc_agent.py --host 192.168.1.150 --port 8080
  esp32-pc-agent.exe --host 192.168.1.150 --port 8080

Windows firewall tip: allow outbound HTTP to the ESP32 LAN address,
or temporarily allow Python / esp32-pc-agent.exe through the firewall.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from typing import Optional

try:
    import psutil
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Brak pakietu psutil. Zainstaluj: pip install -r requirements.txt"
    ) from exc

try:
    import requests
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Brak pakietu requests. Zainstaluj: pip install -r requirements.txt"
    ) from exc


def root_disk_path() -> str:
    if os.name == "nt":
        return "C:\\"
    return "/"


def _parse_percent(raw: str) -> int:
    cleaned = raw.strip().replace("%", "")
    return max(0, min(100, int(float(cleaned))))


def read_gpu_percent() -> int:
    """Best-effort GPU util: NVIDIA nvidia-smi, then Windows typeperf (GPU Engine)."""
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            completed = subprocess.run(
                [
                    nvidia_smi,
                    "--query-gpu=utilization.gpu",
                    "--format=csv,noheader,nounits",
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=2,
            )
            if completed.returncode == 0:
                line = (completed.stdout or "").strip().splitlines()
                if line:
                    return _parse_percent(line[0])
        except Exception:
            pass

    # Windows AMD/Intel: sample "GPU Engine(*)\\Utilization Percentage" via typeperf
    if os.name == "nt" and shutil.which("typeperf"):
        try:
            completed = subprocess.run(
                [
                    "typeperf",
                    r"\GPU Engine(*)\Utilization Percentage",
                    "-sc",
                    "1",
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=4,
            )
            if completed.returncode == 0:
                values: list[float] = []
                for line in (completed.stdout or "").splitlines():
                    if line.startswith('"') and "," in line and not line.lower().startswith('"timestamp'):
                        parts = [p.strip().strip('"') for p in line.split(",")]
                        for part in parts[1:]:
                            try:
                                values.append(float(part))
                            except ValueError:
                                continue
                if values:
                    return max(0, min(100, int(round(max(values)))))
        except Exception:
            pass

    return 0


def collect_stats(include_gpu: bool) -> dict:
    cpu = int(psutil.cpu_percent(interval=1))
    ram = int(psutil.virtual_memory().percent)
    try:
        disk = int(psutil.disk_usage(root_disk_path()).percent)
    except Exception:
        disk = int(psutil.disk_usage("/").percent)
    gpu = read_gpu_percent() if include_gpu else 0
    return {"cpu": cpu, "ram": ram, "gpu": gpu, "disk": disk}


def post_stats(url: str, payload: dict, timeout: float) -> int:
    response = requests.post(url, json=payload, timeout=timeout)
    return response.status_code


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ESP32 Display Studio — agent monitora zasobów PC"
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("ESP32_HOST", "192.168.1.150"),
        help="Adres IP ESP32 w sieci LAN (domyślnie 192.168.1.150)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("ESP32_PORT", "8080")),
        help="Port HTTP serwera na ESP32 (domyślnie 8080)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.environ.get("ESP32_AGENT_INTERVAL", "1.0")),
        help="Dodatkowa przerwa między wysyłkami w sekundach (po pomiarze CPU)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=2.0,
        help="Timeout HTTP w sekundach",
    )
    parser.add_argument(
        "--no-gpu",
        action="store_true",
        help="Nie odpytuj nvidia-smi (GPU zawsze 0)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Wyślij jedną próbkę i zakończ (przydatne w testach)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    url = f"http://{args.host}:{args.port}/api/pc-stats"
    include_gpu = not args.no_gpu

    print("ESP32 Display Studio — PC Agent")
    print(f"Cel: {url}")
    print(f"GPU: {'nvidia-smi (opcjonalnie)' if include_gpu else 'wyłączone'}")
    print("Ctrl+C aby zatrzymać. Firewall Windows: zezwól na ruch HTTP do ESP32 w LAN.")

    while True:
        try:
            payload = collect_stats(include_gpu=include_gpu)
            status = post_stats(url, payload, timeout=args.timeout)
            print(
                f"Wysłano: CPU {payload['cpu']}%, RAM {payload['ram']}%, "
                f"GPU {payload['gpu']}%, Dysk {payload['disk']}% -> HTTP {status}"
            )
        except KeyboardInterrupt:
            print("\nZatrzymano agenta.")
            return 0
        except Exception as exc:
            print(f"Oczekiwanie na połączenie z ESP32: {exc}")

        if args.once:
            return 0
        if args.interval > 0:
            time.sleep(args.interval)


if __name__ == "__main__":
    sys.exit(main())
