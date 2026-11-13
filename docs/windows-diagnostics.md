# Diagnostyka flash/COM (opt-in)

Lokalny log diagnostyczny — **bez telemetrii chmurowej**.

## Włączenie

**Ustawienia → Desktop → Diagnostyka flash/COM**

Log: `%LOCALAPPDATA%\studio.esp32.display\diagnostics\studio.log`  
(przycisk „Otwórz folder logów”).

## Co trafia do logu

- Wyniki **Build** / **Flash** (komunikat, port, chip, offset)
- Tylko gdy przełącznik jest włączony (preferencja w `localStorage` + flaga w shellu Tauri)

## Board presets cache

Po udanym build/flash Studio zapamiętuje per `VID:PID` (+ port):

- chip / offset / baud / board profile

Przy kolejnym podłączeniu tej samej płytki wartości wracają automatycznie (`localStorage`).
