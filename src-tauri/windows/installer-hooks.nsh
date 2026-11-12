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
Dokumentacja: https://github.com/mateowoj-cpu/ESP32-App/blob/main/docs/windows-drivers.md"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
