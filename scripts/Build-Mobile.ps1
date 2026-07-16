#requires -Version 7.0
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet('Android','iOS','Both')]
    [string]$Platform = 'Android',
    [switch]$OpenIDE,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is required.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required.' }
$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw "Node.js 22+ is required. Current: $(node --version)" }

if ($Clean) {
    foreach ($path in @('node_modules','android','ios')) {
        if (Test-Path $path) { Remove-Item $path -Recurse -Force }
    }
    if (Test-Path 'package-lock.json') { Remove-Item 'package-lock.json' -Force }
}

npm install

$targets = switch ($Platform) {
    'Both' { @('android','ios') }
    default { @($Platform.ToLowerInvariant()) }
}

foreach ($target in $targets) {
    if ($target -eq 'ios' -and -not $IsMacOS) {
        Write-Warning 'iOS native project generation and signing require macOS with Xcode. Skipping iOS on this computer.'
        continue
    }
    if (-not (Test-Path $target)) {
        npx cap add $target
    }
    npx cap sync $target
    Write-Host "Prepared $target project." -ForegroundColor Green
    if ($OpenIDE) { npx cap open $target }
}
