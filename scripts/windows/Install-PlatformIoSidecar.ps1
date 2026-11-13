#Requires -Version 5.1
<#
.SYNOPSIS
  Installs an offline PlatformIO Core sidecar + espota.py for ESP32 Display Studio (Faza 9).

.DESCRIPTION
  Places tools under:
    %LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv\   (pio.exe)
    %LOCALAPPDATA%\studio.esp32.display\sidecar\ota\espota.py

  Studio resolves these paths without requiring PlatformIO on the user PATH.
  Override with env ESP32_STUDIO_PIO / ESP32_STUDIO_ESPOTA.

.NOTES
  Tauri identifier: studio.esp32.display → app local data folder name.
#>

[CmdletBinding()]
param(
  [string]$TargetRoot = "",
  [switch]$SkipEspota
)

$ErrorActionPreference = "Stop"

function Get-StudioLocalData {
  if ($TargetRoot) { return $TargetRoot }
  $base = $env:LOCALAPPDATA
  if (-not $base) { throw "LOCALAPPDATA is not set." }
  # Tauri 2 on Windows uses the bundle identifier as the folder name.
  Join-Path $base "studio.esp32.display"
}

$root = Get-StudioLocalData
$pioRoot = Join-Path $root "sidecar\platformio"
$otaRoot = Join-Path $root "sidecar\ota"
New-Item -ItemType Directory -Force -Path $pioRoot | Out-Null
New-Item -ItemType Directory -Force -Path $otaRoot | Out-Null

Write-Host "==> Sidecar root: $root"

$py = $null
foreach ($cand in @("py", "python", "python3")) {
  $cmd = Get-Command $cand -ErrorAction SilentlyContinue
  if ($cmd) {
    $py = $cmd.Source
    break
  }
}
if (-not $py) {
  throw "Python 3 not found. Install from https://www.python.org/ (check 'Add to PATH')."
}

Write-Host "==> Using Python: $py"

$penv = Join-Path $pioRoot "penv"
if (-not (Test-Path (Join-Path $penv "Scripts\python.exe"))) {
  Write-Host "==> Creating virtualenv at $penv"
  & $py -3 -m venv $penv
  if ($LASTEXITCODE -ne 0) {
    & $py -m venv $penv
  }
}

$pip = Join-Path $penv "Scripts\pip.exe"
$pioExe = Join-Path $penv "Scripts\pio.exe"
if (-not (Test-Path $pip)) {
  throw "venv pip missing at $pip"
}

Write-Host "==> Installing platformio into sidecar venv (this may take several minutes)…"
& $pip install --upgrade pip
& $pip install "platformio"

if (-not (Test-Path $pioExe)) {
  throw "pio.exe not found after install: $pioExe"
}

Write-Host "==> PlatformIO OK: $(& $pioExe --version)"

if (-not $SkipEspota) {
  $espota = Join-Path $otaRoot "espota.py"
  $url = "https://raw.githubusercontent.com/espressif/arduino-esp32/master/tools/espota.py"
  Write-Host "==> Downloading espota.py → $espota"
  try {
    Invoke-WebRequest -Uri $url -OutFile $espota -UseBasicParsing
  } catch {
    Write-Warning "Could not download espota.py: $_"
    Write-Warning "Place espota.py manually at $espota (from Arduino-ESP32 tools/)."
  }
  if (Test-Path $espota) {
    Write-Host "==> espota.py ready ($((Get-Item $espota).Length) bytes)"
  }
}

Write-Host ""
Write-Host "Done. Restart ESP32 Display Studio — Build should show PlatformIO (sidecar)."
Write-Host "Optional env overrides:"
Write-Host "  ESP32_STUDIO_PIO=$pioExe"
Write-Host "  ESP32_STUDIO_ESPOTA=$(Join-Path $otaRoot 'espota.py')"
