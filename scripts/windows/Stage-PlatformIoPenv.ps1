#Requires -Version 5.1
<#
.SYNOPSIS
  Stages a PlatformIO Core penv into Tauri NSIS/MSI resources for optional offline bundling (Faza 10).

.DESCRIPTION
  Copies (or builds) a PlatformIO virtualenv into:
    src-tauri/resources/sidecar/platformio/penv/

  The folder is gitignored — never commit a full penv. Use this script on a signed-release
  machine / CI job that already has Python + network, then run `npm run tauri:build:windows`
  so Tauri packs `resources/sidecar/**/*`.

  Without staging, the installer still ships `resources/sidecar/README.txt` and the post-install
  hook points users at Install-PlatformIoSidecar.ps1 (LocalAppData sidecar).

.PARAMETER SourcePenv
  Existing penv to copy. Defaults to %LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv

.PARAMETER BuildIfMissing
  If SourcePenv is missing, run Install-PlatformIoSidecar.ps1 first.

.EXAMPLE
  powershell -File .\scripts\windows\Stage-PlatformIoPenv.ps1 -BuildIfMissing
#>

[CmdletBinding()]
param(
  [string]$SourcePenv = "",
  [string]$RepoRoot = "",
  [switch]$BuildIfMissing,
  [switch]$SkipEspota
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  if ($RepoRoot) { return (Resolve-Path $RepoRoot).Path }
  $here = Split-Path -Parent $PSScriptRoot
  # scripts/windows → repo root
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$root = Resolve-RepoRoot
$destBase = Join-Path $root "src-tauri\resources\sidecar\platformio"
$destPenv = Join-Path $destBase "penv"
$destOta = Join-Path $root "src-tauri\resources\sidecar\ota"

if (-not $SourcePenv) {
  $SourcePenv = Join-Path $env:LOCALAPPDATA "studio.esp32.display\sidecar\platformio\penv"
}

$pioMarker = Join-Path $SourcePenv "Scripts\pio.exe"
if (-not (Test-Path $pioMarker)) {
  if (-not $BuildIfMissing) {
    throw "Source penv missing at $SourcePenv. Pass -BuildIfMissing or run Install-PlatformIoSidecar.ps1 first."
  }
  $installer = Join-Path $root "scripts\windows\Install-PlatformIoSidecar.ps1"
  Write-Host "==> Building LocalAppData sidecar via $installer"
  & powershell -NoProfile -File $installer
  if (-not (Test-Path $pioMarker)) {
    throw "Install-PlatformIoSidecar.ps1 did not produce $pioMarker"
  }
}

Write-Host "==> Staging penv"
Write-Host "    from: $SourcePenv"
Write-Host "    to:   $destPenv"

New-Item -ItemType Directory -Force -Path $destBase | Out-Null
if (Test-Path $destPenv) {
  Write-Host "==> Removing previous staged penv"
  Remove-Item -Recurse -Force $destPenv
}

# Robocopy is faster/more reliable for large trees on Windows.
$rc = Start-Process -FilePath "robocopy.exe" -ArgumentList @(
  $SourcePenv, $destPenv, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
) -Wait -PassThru
# robocopy exit codes 0–7 are success-ish
if ($rc.ExitCode -ge 8) {
  throw "robocopy failed with exit $($rc.ExitCode)"
}

if (-not $SkipEspota) {
  $srcEspota = Join-Path $env:LOCALAPPDATA "studio.esp32.display\sidecar\ota\espota.py"
  if (Test-Path $srcEspota) {
    New-Item -ItemType Directory -Force -Path $destOta | Out-Null
    Copy-Item -Force $srcEspota (Join-Path $destOta "espota.py")
    Write-Host "==> Staged espota.py → resources/sidecar/ota/"
  }
}

$readme = Join-Path $root "src-tauri\resources\sidecar\README.txt"
if (Test-Path $readme) {
  Write-Host "==> README present: $readme"
}

Write-Host ""
Write-Host "Staged. Next:"
Write-Host "  1. Confirm tauri.conf.json bundles resources/sidecar/**/*"
Write-Host "  2. npm run tauri:build:windows  (or signed CI job)"
Write-Host "  3. Do NOT commit penv/ — it stays gitignored"
Write-Host ""
Write-Host "Done."
