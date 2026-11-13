# Opt-in diagnostic telemetry

Studio keeps **local** flash/COM diagnostics (log + ZIP) separate from optional
**network** telemetry (added in Phase 13; ops polish in Phase 15). Telemetry is
**off by default**. Docs index: [README.md](./README.md) · local ZIP:
[windows-diagnostics.md](./windows-diagnostics.md).

## What is sent (only when enabled)

Preference: **Ustawienia → Desktop → Telemetria diagnostyczna (opt-in)**.

When the toggle is on **and** the build defines `VITE_TELEMETRY_ENDPOINT`
(HTTPS URL), Studio may POST a tiny JSON body:

| Field | Meaning |
|-------|---------|
| `v` | App version (e.g. `0.2.8`) |
| `os` | Coarse OS: `windows` / `macos` / `linux` / `other` |
| `event` | `app_open`, `build_result`, `flash_result`, `ota_result`, `diag_export`, `board_sync` |
| `ok` | Optional boolean for result events |
| `ts` | Unix ms timestamp |

## What is never sent

- Serial monitor text, boot logs, MAC addresses, chip serial numbers
- File paths, project JSON, Wi‑Fi credentials, OTA passwords
- Personal identifiers, emails, machine names, IP addresses
- Diagnostics ZIP contents (ZIP stays local — see [windows-diagnostics.md](./windows-diagnostics.md))

## Endpoint (`VITE_TELEMETRY_ENDPOINT`)

- Set `VITE_TELEMETRY_ENDPOINT=https://…` at **build time** for desktop/web builds that should be able to report.
- Without the env var, enabling the toggle stores consent only — **no network calls**.
- Do **not** commit secrets or private collector tokens into git.
- Documented in `.env.example` (commented). CI may inject the secret as a build env for release jobs only when the human configures it.

Example (local / CI, never commit the real URL if it embeds a token):

```bash
VITE_TELEMETRY_ENDPOINT=https://telemetry.example.com/v1/ingest
```

## Opt-out

| Layer | Behavior |
|-------|----------|
| Default | Preference off (`localStorage` key unset) |
| UI toggle | **Ustawienia → Desktop → Telemetria** → off clears consent (`esp32_telemetry` ≠ `1`) |
| Build without endpoint | Even with toggle on, client is a no-op |
| Uninstall / clear site data | Removes `localStorage` consent |

There is no background phone-home when the preference is off.

## Retention (collector ops — human)

Studio does **not** host a collector. Whoever runs `VITE_TELEMETRY_ENDPOINT` should publish retention publicly. Recommended baseline:

| Policy | Recommendation |
|--------|----------------|
| Retention | ≤ 90 days, then delete or aggregate to anonymous counters |
| Access | Ops-only; no adtech / resale |
| PII | Payload has none by design — still treat logs around the collector as sensitive |
| Deletion | Support a “drop all events before date X” ops runbook |
| Legal | Link privacy note from release notes if you ship a live endpoint |

### Minimal collector checklist

1. HTTPS-only ingest accepting `POST` JSON matching the table above (ignore unknown fields).
2. Rate-limit by coarse IP; drop oversized bodies (>2 KiB).
3. Store `v`, `os`, `event`, `ok`, `ts` only.
4. Document retention + opt-out in your privacy page; link from app release notes.
5. Rotate any ingest tokens out-of-band — never put them in this git repo.

### Example request body

```json
{ "v": "0.2.8", "os": "windows", "event": "flash_result", "ok": true, "ts": 1730000000000 }
```

## Implementation

- Preference key: `localStorage` `esp32_telemetry` (`1` = on)
- Client: `src/platform/telemetry.ts`
- UI: Desktop settings panel
