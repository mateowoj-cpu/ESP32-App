#Requires -Version 5.1
<#
.SYNOPSIS
  Imports a Base64-encoded .pfx into CurrentUser\My for Tauri Authenticode signing.

.DESCRIPTION
  Used by CI and local builds. Expects:
    WINDOWS_CERTIFICATE          - Base64 of the .pfx file
    WINDOWS_CERTIFICATE_PASSWORD - PFX password

  Prints the certificate thumbprint to GITHUB_OUTPUT when running in Actions.
#>
param(
  [string]$CertificateBase64 = $env:WINDOWS_CERTIFICATE,
  [string]$CertificatePassword = $env:WINDOWS_CERTIFICATE_PASSWORD,
  [string]$OutConfigPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CertificateBase64)) {
  Write-Host "WINDOWS_CERTIFICATE not set — skipping certificate import (unsigned build)."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($CertificatePassword)) {
  throw "WINDOWS_CERTIFICATE_PASSWORD is required when WINDOWS_CERTIFICATE is set."
}

$tempPfx = Join-Path ([System.IO.Path]::GetTempPath()) ("esp32-studio-codesign-" + [guid]::NewGuid().ToString() + ".pfx")
try {
  $bytes = [Convert]::FromBase64String($CertificateBase64)
  [IO.File]::WriteAllBytes($tempPfx, $bytes)

  $secure = ConvertTo-SecureString -String $CertificatePassword -AsPlainText -Force
  $cert = Import-PfxCertificate -FilePath $tempPfx -CertStoreLocation Cert:\CurrentUser\My -Password $secure
  $thumbprint = $cert.Thumbprint
  Write-Host "Imported code signing certificate. Thumbprint=$thumbprint"

  if ($env:GITHUB_OUTPUT) {
    "thumbprint=$thumbprint" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
  }

  if (-not [string]::IsNullOrWhiteSpace($OutConfigPath)) {
    $json = @{
      bundle = @{
        windows = @{
          certificateThumbprint = $thumbprint
          digestAlgorithm       = "sha256"
          timestampUrl          = "http://timestamp.digicert.com"
          tsp                   = $false
        }
      }
    } | ConvertTo-Json -Depth 6
    $dir = Split-Path -Parent $OutConfigPath
    if ($dir -and -not (Test-Path $dir)) {
      New-Item -ItemType Directory -Path $dir | Out-Null
    }
    Set-Content -Path $OutConfigPath -Value $json -Encoding UTF8
    Write-Host "Wrote signing overlay: $OutConfigPath"
  }
}
finally {
  if (Test-Path $tempPfx) {
    Remove-Item -Force $tempPfx
  }
}
