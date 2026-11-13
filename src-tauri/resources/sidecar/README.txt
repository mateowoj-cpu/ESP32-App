ESP32 Display Studio — Sidecar toolchain (Faza 9)
=================================================

Studio looks for an offline PlatformIO Core here (bundled resources) and under
the app local data directory — without requiring `pio` on the user PATH.

Recommended install (Windows)
-----------------------------
  powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1

That creates:
  %LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv\Scripts\pio.exe
  %LOCALAPPDATA%\studio.esp32.display\sidecar\ota\espota.py

Optional layout next to this README (for advanced installers that stage a
pre-built penv into the NSIS/MSI resources):

  sidecar/platformio/penv/Scripts/pio.exe
  sidecar/ota/espota.py

Env overrides
-------------
  ESP32_STUDIO_PIO     — full path to pio / pio.exe
  ESP32_STUDIO_ESPOTA  — full path to espota.py

Docs: docs/windows-sidecar-pio.md · docs/windows-ota.md
