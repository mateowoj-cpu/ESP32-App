# Agent PC (Windows `.exe`)

Agent wysyła telemetrię hosta do ESP32 Display Studio:

`POST http://<ESP32_IP>:<PORT>/api/pc-stats`  
`{"cpu":12,"ram":45,"gpu":0,"disk":64}`

## Opcje dystrybucji

| Forma | Skąd | Kiedy |
|-------|------|--------|
| `esp32-pc-agent.exe` | GitHub Releases / folder instalacji Studio | użytkownicy Windows |
| `tools/pc-agent/esp32_pc_agent.py` | repo | dev / Linux / macOS |
| Przycisk w UI **Integracje** | generuje `.py` z IP/portem | szybki start |

## Build `.exe` (Windows)

```powershell
powershell -File .\scripts\windows\Build-PcAgent.ps1
```

Wynik:

- `tools/pc-agent/dist/esp32-pc-agent.exe`
- `src-tauri/binaries/esp32-pc-agent-x86_64-pc-windows-msvc.exe` (sidecar Tauri)
- `src-tauri/resources/windows/esp32-pc-agent.exe` (zasób instalacji)

## Uruchomienie

```powershell
.\esp32-pc-agent.exe --host 192.168.1.150 --port 8080
```

W aplikacji desktop (Tauri): **Integracje → Monitor PC → Start** (jeśli `.exe` jest w zasobach).

## GPU

Domyślnie agent próbuje odczytać NVIDIA GPU przez `nvidia-smi`.  
Bez NVIDIA / bez sterownika wartość `gpu` = `0`. Flaga `--no-gpu` wyłącza odpytywanie.

## Firewall

Windows może blokować wychodzący HTTP do urządzenia w LAN.

1. Gdy Windows zapyta — zezwól na dostęp w sieciach prywatnych.
2. Albo: Zapora Windows → reguła wychodząca dla `esp32-pc-agent.exe`.
3. Sprawdź, że telefon/PC i ESP32 są w tej samej podsieci.

## CI

Workflow `windows-release.yml` buduje agenta przed `tauri build` i dołącza `.exe` do releasu oraz (przez nakładkę) do instalatora.
