#requires -Version 7.0
[CmdletBinding()]
param([switch]$Browser)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Required = @(
    'www/index.html',
    'www/styles.css',
    'www/js/app.js',
    'www/js/engine.js',
    'www/js/render.js',
    'www/js/palettes.js',
    'www/js/selftests.js',
    'www/manifest.webmanifest',
    'www/sw.js',
    'capacitor.config.json',
    'android/app/build.gradle',
    'ios/App/App.xcodeproj/project.pbxproj'
)

foreach ($RelativePath in $Required) {
    $Path = Join-Path $Root $RelativePath
    if (-not (Test-Path $Path)) { throw "Missing required file: $RelativePath" }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required for the test suite.' }
foreach ($Script in Get-ChildItem (Join-Path $Root 'www/js') -Filter '*.js') {
    & node --check $Script.FullName
    if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax validation failed: $($Script.Name)" }
}

Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json | Out-Null
Get-Content (Join-Path $Root 'capacitor.config.json') -Raw | ConvertFrom-Json | Out-Null
Get-Content (Join-Path $Root 'www/manifest.webmanifest') -Raw | ConvertFrom-Json | Out-Null
Write-Host 'PASS: source, JavaScript and JSON validation' -ForegroundColor Green

& node (Join-Path $Root 'tests/run-tests.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Invariant self-tests failed.' }
Write-Host 'PASS: invariant self-tests (256 + 448 grids)' -ForegroundColor Green

if ($Browser) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) { throw 'Python is required for the optional Playwright browser test.' }
    & $python.Source (Join-Path $Root 'tests/smoke_test.py')
    if ($LASTEXITCODE -ne 0) { throw 'Browser smoke test failed.' }
}
