; ESP32 Display Studio — NSIS hooks (Phase 3)
; Shown after files are copied; reminds users about USB-UART drivers on Windows.

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
  MessageBox MB_OK|MB_ICONINFORMATION \
    "ESP32 Display Studio zostało zainstalowane.$\r$\n$\r$\n\
Jeśli płytka ESP32 nie pojawia się jako port COMx w aplikacji:$\r$\n\
1. Otwórz Menedżer urządzeń$\r$\n\
2. Zainstaluj sterownik CH340 / CP210x / Espressif$\r$\n\
3. Zobacz plik DRIVERS.txt w folderze instalacji$\r$\n$\r$\n\
Projekty: pliki .esp32studio otwierają się w Studio.$\r$\n\
Build offline: jeśli instalator zawiera sidecar/platformio/penv — używany automatycznie.$\r$\n\
W przeciwnym razie: scripts\\windows\\Install-PlatformIoSidecar.ps1$\r$\n\
(albo Stage-PlatformIoPenv.ps1 przy budowie signed release).$\r$\n\
Flash USB: esptool · OTA Wi-Fi: espota / mDNS (USB → Build → Flash).$\r$\n$\r$\n\
Dokumentacja: https://github.com/mateowoj-cpu/ESP32-App/blob/main/docs/windows-sidecar-pio.md"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
