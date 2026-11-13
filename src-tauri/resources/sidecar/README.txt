ESP32 Display Studio — Sidecar toolchain (Faza 9–10)
====================================================

Studio looks for an offline PlatformIO Core here (bundled resources) and under
the app local data directory — without requiring `pio` on the user PATH.

Recommended install (Windows, post-setup)
-----------------------------------------
  powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1

That creates:
  %LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv\Scripts\pio.exe
  %LOCALAPPDATA%\studio.esp32.display\sidecar\ota\espota.py

Optional: bundle penv in the signed installer (Faza 10)
-------------------------------------------------------
On the release machine / CI (never commit the penv tree):

  powershell -File .\scripts\windows\Stage-PlatformIoPenv.ps1 -BuildIfMissing

Stages into resources next to this README:

  sidecar/platformio/penv/Scripts/pio.exe
  sidecar/ota/espota.py

tauri.conf.json includes `resources/sidecar/**/*` so a staged penv is packed
into NSIS/MSI. The penv path is gitignored.

Env overrides
-------------
  ESP32_STUDIO_PIO     — full path to pio / pio.exe
  ESP32_STUDIO_ESPOTA  — full path to espota.py

Docs: docs/windows-sidecar-pio.md · docs/windows-ota.md · docs/windows-winget.md
