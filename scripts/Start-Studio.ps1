#requires -Version 7.0
[CmdletBinding()]
param([ValidateRange(1024,65535)][int]$Port = 4187, [switch]$Install)
$ErrorActionPreference = 'Stop'
$StudioRoot = Split-Path -Parent $PSScriptRoot
$StudioPython = Join-Path $StudioRoot '.venv\Scripts\python.exe'
if ($Install) {
    if (-not (Test-Path $StudioPython)) {
        python -m venv (Join-Path $StudioRoot '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed' }
    }
    & $StudioPython -m pip install -r (Join-Path $StudioRoot 'requirements-laya.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Laya dependency installation failed' }
}
if (-not (Test-Path $StudioPython)) { throw 'Run this script with -Install once to prepare local Laya.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Choose a different -Port or use the existing server."
}
& $StudioPython -u (Join-Path $StudioRoot 'server.py') --port $Port
if ($LASTEXITCODE -ne 0) { throw 'Studio server exited with an error' }
