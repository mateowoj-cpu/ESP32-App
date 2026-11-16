#Requires -Version 5.1
<#
.SYNOPSIS
  Writes tauri.windows-signing.local.json from PFX import or a pre-installed thumbprint.

.DESCRIPTION
  Faza 16 — EV / HSM path for self-hosted Windows runners:
    1) If WINDOWS_CERTIFICATE (+ password) is set → import PFX (OV / exportable).
    2) Else if WINDOWS_CERTIFICATE_THUMBPRINT is set → use that thumbprint only
       (token USB / cloud HSM cert already in CurrentUser\My — never invent a hash).
    3) Else → unsigned build (no overlay file).

  Do not commit real thumbprints or PFX material.
#>
param(
  [string]$CertificateBase64 = $env:WINDOWS_CERTIFICATE,
  [string]$CertificatePassword = $env:WINDOWS_CERTIFICATE_PASSWORD,
  [string]$CertificateThumbprint = $env:WINDOWS_CERTIFICATE_THUMBPRINT,
  [string]$OutConfigPath = "./src-tauri/tauri.windows-signing.local.json"
)

$ErrorActionPreference = "Stop"

function Write-SigningOverlay([string]$Thumbprint, [string]$Path) {
  $json = @{
    bundle = @{
      windows = @{
        certificateThumbprint = $Thumbprint
        digestAlgorithm       = "sha256"
        timestampUrl          = "http://timestamp.digicert.com"
        tsp                   = $false
      }
    }
  } | ConvertTo-Json -Depth 6
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Set-Content -Path $Path -Value $json -Encoding UTF8
  Write-Host "Wrote signing overlay: $Path (thumbprint=$Thumbprint)"
}

if (-not [string]::IsNullOrWhiteSpace($CertificateBase64)) {
  & "$PSScriptRoot/Import-CodeSigningCertificate.ps1" `
    -CertificateBase64 $CertificateBase64 `
    -CertificatePassword $CertificatePassword `
    -OutConfigPath $OutConfigPath
  exit $LASTEXITCODE
}

$thumb = ($CertificateThumbprint -replace '\s', '').ToUpperInvariant()
if ([string]::IsNullOrWhiteSpace($thumb)) {
  Write-Host "No WINDOWS_CERTIFICATE / WINDOWS_CERTIFICATE_THUMBPRINT — unsigned build."
  exit 0
}

if ($thumb -notmatch '^[0-9A-F]{40}$') {
  throw "WINDOWS_CERTIFICATE_THUMBPRINT must be a 40-char SHA1 hex string (no invented values)."
}

$found = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $thumb }
if (-not $found) {
  throw "Thumbprint $thumb not found in Cert:\CurrentUser\My. Install EV token / HSM cert on this runner first."
}

Write-SigningOverlay -Thumbprint $thumb -Path $OutConfigPath
if ($env:GITHUB_OUTPUT) {
  "thumbprint=$thumb" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
  "mode=thumbprint" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}
exit 0
