# One-time machine setup for the Feature Tracker. Idempotent — rerun it any
# time the repo moves or you change the port.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1 [-Port 3000] [-NoShortcut]
#
# It figures out this machine's values itself (repo path from the script's
# location, home from $env:USERPROFILE) and:
#   1. installs npm dependencies if node_modules is missing
#   2. writes tracker.config.json (gitignored) with the chosen port
#   3. installs the /to-feature skill to ~\.claude\skills\to-feature,
#      stamping {{TRACKER_ROOT}} and {{PORT}} in skills\to-feature\SKILL.md
#   4. creates a "Feature Tracker" desktop shortcut to launch-board.vbs
param(
    [ValidateRange(1, 65535)][int]$Port = 3000,
    [switch]$NoShortcut
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Feature Tracker setup"
Write-Host "  repo: $root"
Write-Host "  port: $Port"
Write-Host ""

# --- 1. npm dependencies ---------------------------------------------------
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js 18.18+ (https://nodejs.org) and rerun."
}
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host "Installing npm dependencies (first run)..."
    Push-Location $root
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "npm dependencies already installed - skipping."
}

# --- 2. tracker.config.json ------------------------------------------------
$configPath = Join-Path $root 'tracker.config.json'
# WriteAllText writes UTF-8 without a BOM (PS 5.1's -Encoding utf8 adds one,
# which breaks JSON/frontmatter parsers).
[IO.File]::WriteAllText($configPath, "{`n  `"port`": $Port`n}`n")
Write-Host "Wrote $configPath"

# --- 3. /to-feature skill --------------------------------------------------
$skillSrc = Join-Path $root 'skills\to-feature\SKILL.md'
$skillDstDir = Join-Path $env:USERPROFILE '.claude\skills\to-feature'
$skillDst = Join-Path $skillDstDir 'SKILL.md'
New-Item -ItemType Directory -Force -Path $skillDstDir | Out-Null
$stamped = (Get-Content $skillSrc -Raw -Encoding utf8) `
    -replace '\{\{TRACKER_ROOT\}\}', $root.Replace('$', '$$') `
    -replace '\{\{PORT\}\}', "$Port"
# Drop the template banner comment — the installed copy points back here.
$stamped = $stamped -replace '(?s)<!--.*?-->\r?\n\r?\n', ''
[IO.File]::WriteAllText($skillDst, $stamped)
Write-Host "Installed /to-feature skill to $skillDst"

# --- 4. desktop shortcut ---------------------------------------------------
if (-not $NoShortcut) {
    $shell = New-Object -ComObject WScript.Shell
    $desktop = $shell.SpecialFolders.Item('Desktop')
    $lnk = $shell.CreateShortcut((Join-Path $desktop 'Feature Tracker.lnk'))
    $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $lnk.Arguments = '"' + (Join-Path $root 'scripts\launch-board.vbs') + '"'
    $lnk.WorkingDirectory = $root
    $lnk.IconLocation = Join-Path $root 'scripts\board.ico'
    $lnk.Description = 'Feature Tracker board'
    $lnk.Save()
    Write-Host "Created desktop shortcut 'Feature Tracker'"
} else {
    Write-Host "Skipped desktop shortcut (-NoShortcut)."
}

Write-Host ""
Write-Host "Done. Launch from the desktop shortcut, or:"
Write-Host "  npm run dev -- -p $Port    # then open http://localhost:$Port"
Write-Host "The data\ directory is created on first run and stays local to this machine."
