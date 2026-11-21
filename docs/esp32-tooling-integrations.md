# Free ESP32 tooling integrations

> **PL:** Studio wykrywa opcjonalne darmowe narzędzia hosta (PlatformIO, Arduino CLI/IDE, esptool, ESP-IDF, Wokwi), pozwala nadpisać ścieżki w Ustawieniach desktop, wybrać toolchain w Flash Helperze i otworzyć Arduino IDE / Wokwi — bez wymogu instalacji wszystkich narzędzi.

Short EN summary: Studio detects optional free host tools (PlatformIO, Arduino CLI/IDE, esptool, ESP-IDF, Wokwi), lets you override binary paths in Desktop Settings, pick a build tool in Flash Helper, and launch Arduino IDE / Wokwi without requiring every tool to be installed.

Linia: **0.2.12**. Indeks: [README.md](./README.md).

## Resolve order

For PlatformIO / arduino-cli / esptool:

1. Path override from Desktop Settings (`tool-paths.json` in app local data)
2. Env / sidecar (`ESP32_STUDIO_PIO`, bundled penv)
3. PATH (`which` / `where`)

## UI surfaces

| Surface | What shipped |
|---------|----------------|
| Desktop Settings | Path overrides + detection status + homepage links |
| Flash Helper | Preferred build tool (`auto` / PlatformIO / arduino-cli), Open Arduino IDE, Open Wokwi, Open project folder |
| Code Generator | Open in Arduino IDE, Simulate in Wokwi |

## Tools

| Tool | Free? | Integration |
|------|-------|-------------|
| PlatformIO CLI | Yes (Apache/MIT ecosystem) | Detect + build (existing) + path override |
| Arduino CLI | Yes | Detect + build fallback + path override |
| Arduino IDE | Yes | Detect + export sketch folder + launch / reveal |
| esptool | Yes (GPLv2 / Apache dual) | Detect + flash (existing) + path override |
| ESP-IDF (`idf.py`) | Yes (Apache 2.0) | Detect-only (Studio builds Arduino framework) |
| Wokwi web | Free tier | Open ESP32 template in browser |
| Wokwi CLI | Free/open CLI | Detect + path override (optional) |

## IPC

See [architecture.md](./architecture.md) — External tools commands under Flash permissions.
