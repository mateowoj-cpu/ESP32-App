# ESP32 PC Agent

Agent monitora zasobów PC dla ESP32 Display Studio.

**Jeden artefakt źródłowy:** `esp32_pc_agent.py` (parametry `--host` / `--port`).  
Windows: ten sam plik → PyInstaller → `esp32-pc-agent.exe`.  
macOS / Linux: osobna instalacja Python 3 + zależności.

Wysyła `CPU` / `RAM` / `Dysk` / opcjonalnie `GPU` (nvidia-smi) na:

`POST http://<ESP32_IP>:<PORT>/api/pc-stats`

## Python (dev / macOS / Linux)

```bash
cd tools/pc-agent
pip install -r requirements.txt
python3 esp32_pc_agent.py --host 192.168.1.150 --port 8080
```

Test odbiornika HTTP (asercje danych + kod wyjścia):

```bash
pip install -r requirements.txt
python3 test_http_receiver.py
# lub: npm run pc-agent:test
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
