# Returns $true when $Key looks like a minisign / tauri-signer private key
# (must contain an "untrusted comment:" line). Does not log the key material.
param(
  [Parameter(Mandatory = $false)]
  [AllowEmptyString()]
  [string]$Key = ""
)

function Test-TauriUpdaterKeyFormat {
  param([AllowEmptyString()][string]$Key)

  if ([string]::IsNullOrWhiteSpace($Key)) {
    return $false
  }

  $content = $Key.Trim()
  # GitHub secrets sometimes store literal \n instead of newlines.
  $content = $content -replace '\\n', "`n"
  $content = $content -replace '\\r', ""

  # Path to a key file (local / self-hosted) — read without printing.
  if (($content.Length -lt 512) -and (Test-Path -LiteralPath $content)) {
    try {
      $content = [System.IO.File]::ReadAllText($content)
    } catch {
      return $false
    }
  }

  return [bool]($content -match '(?m)^untrusted comment:')
}

# When dot-sourced / imported as a module helper, skip auto-run.
if ($MyInvocation.InvocationName -ne '.') {
  if (Test-TauriUpdaterKeyFormat -Key $Key) {
    exit 0
  }
  exit 1
}
