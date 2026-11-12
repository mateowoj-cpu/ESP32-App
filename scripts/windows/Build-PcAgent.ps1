#Requires -Version 5.1
<#
.SYNOPSIS
  Builds esp32-pc-agent.exe with PyInstaller and stages it for Tauri externalBin.
#>
param(
  [string]$Python = "python",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$agentDir = Join-Path $root "tools\pc-agent"
$distExe = Join-Path $agentDir "dist\esp32-pc-agent.exe"
$binariesDir = Join-Path $root "src-tauri\binaries"
$staged = Join-Path $binariesDir "esp32-pc-agent-x86_64-pc-windows-msvc.exe"
$resourceCopy = Join-Path $root "src-tauri\resources\windows\esp32-pc-agent.exe"

Push-Location $agentDir
try {
  & $Python -m pip install -r requirements-build.txt
  if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

  & $Python -m PyInstaller --noconfirm --clean esp32_pc_agent.spec
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }

  if (-not (Test-Path $distExe)) {
    throw "Expected output missing: $distExe"
  }

  New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null
  Copy-Item -Force $distExe $staged
  Copy-Item -Force $distExe $resourceCopy

  if ($OutDir) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Copy-Item -Force $distExe (Join-Path $OutDir "esp32-pc-agent.exe")
  }

  Write-Host "Built PC agent:"
  Write-Host "  $distExe"
  Write-Host "  $staged"
  Write-Host "  $resourceCopy"
}
finally {
  Pop-Location
}
