# Opt-in diagnostic telemetry

Studio keeps **local** flash/COM diagnostics (log + ZIP) separate from optional
**network** telemetry (added in Phase 13). Telemetry is **off by default**.
Docs index: [README.md](./README.md) · local ZIP: [windows-diagnostics.md](./windows-diagnostics.md).

## What is sent (only when enabled)

Preference: **Ustawienia → Desktop → Telemetria diagnostyczna (opt-in)**.

When the toggle is on **and** the build defines `VITE_TELEMETRY_ENDPOINT`
(HTTPS URL), Studio may POST a tiny JSON body:

| Field | Meaning |
|-------|---------|
| `v` | App version (e.g. `0.2.6`) |
| `os` | Coarse OS: `windows` / `macos` / `linux` / `other` |
| `event` | `app_open`, `build_result`, `flash_result`, `ota_result`, `diag_export`, `board_sync` |
| `ok` | Optional boolean for result events |
| `ts` | Unix ms timestamp |

## What is never sent

- Serial monitor text, boot logs, MAC addresses, chip serial numbers
- File paths, project JSON, Wi‑Fi credentials, OTA passwords
- Personal identifiers, emails, machine names, IP addresses
- Diagnostics ZIP contents (ZIP stays local — see [windows-diagnostics.md](./windows-diagnostics.md))

## Endpoint (human / ops)

- Set `VITE_TELEMETRY_ENDPOINT=https://…` at **build time** for desktop/web builds that should be able to report.
- Without the env var, enabling the toggle stores consent only — **no network calls**.
- Do **not** commit secrets or private collector tokens into git.

## Implementation

- Preference key: `localStorage` `esp32_telemetry` (`1` = on)
- Client: `src/platform/telemetry.ts`
- UI: Desktop settings panel
