# ESP32 PC Agent

Agent monitora zasobów PC dla ESP32 Display Studio.

Wysyła `CPU` / `RAM` / `Dysk` / opcjonalnie `GPU` (nvidia-smi) na:

`POST http://<ESP32_IP>:<PORT>/api/pc-stats`

## Python (dev)

```bash
cd tools/pc-agent
pip install -r requirements.txt
python esp32_pc_agent.py --host 192.168.1.150 --port 8080
```

## Windows .exe (PyInstaller)

Na maszynie Windows:

```powershell
cd tools\pc-agent
python -m pip install -r requirements-build.txt
powershell -File ..\..\scripts\windows\Build-PcAgent.ps1
```

Wynik: `tools/pc-agent/dist/esp32-pc-agent.exe`  
CI kopiuje go do `src-tauri/binaries/esp32-pc-agent-x86_64-pc-windows-msvc.exe` przed bundlem Tauri.

## Firewall

Windows może blokować wychodzący HTTP do urządzenia w LAN.  
Zezwól na `esp32-pc-agent.exe` (lub Python) w Zaporze Windows albo utwórz regułę dla ruchu do IP ESP32.
