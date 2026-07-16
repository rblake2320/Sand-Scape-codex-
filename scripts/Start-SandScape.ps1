#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateRange(1024,65535)]
    [int]$Port = 4173,
    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$WebRoot = Join-Path $Root 'www'
if (-not (Test-Path (Join-Path $WebRoot 'index.html'))) {
    throw "SandScape web files were not found at $WebRoot"
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) { throw 'Python 3 is required to run the zero-install local server.' }

$url = "http://localhost:$Port"
if ($OpenBrowser) {
    Start-Job -ScriptBlock {
        param($Target)
        Start-Sleep -Milliseconds 900
        Start-Process $Target
    } -ArgumentList $url | Out-Null
}

Write-Host "SandScape is running at $url" -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop.' -ForegroundColor DarkGray
Push-Location $WebRoot
try {
    if ($python.Name -eq 'py.exe') { & $python.Source -3 -m http.server $Port }
    else { & $python.Source -m http.server $Port }
}
finally { Pop-Location }
