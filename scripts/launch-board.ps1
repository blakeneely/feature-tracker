# Launches the Feature Tracker board: starts the Next.js dev server if it isn't already
# running, waits for it to respond, then opens an app-mode browser window
# (Chrome if installed, else Edge). Invoked by launch-board.vbs so no console
# window appears. The port comes from tracker.config.json (written by
# scripts\setup.ps1), falling back to 43117.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 43117
$configPath = Join-Path $root 'tracker.config.json'
if (Test-Path $configPath) {
    try {
        $configPort = [int](Get-Content $configPath -Raw | ConvertFrom-Json).port
        if ($configPort -ge 1 -and $configPort -le 65535) { $port = $configPort }
    } catch {
        # Unreadable config — stay on the default port rather than failing to launch.
    }
}
$url  = "http://localhost:$port"

function Test-BoardPort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        return $async.AsyncWaitHandle.WaitOne(500) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

if (-not (Test-BoardPort)) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c npm run dev -- -p $port" `
        -WorkingDirectory $root -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(90)
    while (-not (Test-BoardPort)) {
        if ((Get-Date) -gt $deadline) {
            $shell = New-Object -ComObject WScript.Shell
            $shell.Popup("The Feature Tracker server did not start within 90 seconds.`nTry running 'npm run dev' in $root to see the error.", 0, 'Feature Tracker', 48) | Out-Null
            exit 1
        }
        Start-Sleep -Milliseconds 500
    }
}

$browsers = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browser) {
    Start-Process -FilePath $browser -ArgumentList "--app=$url"
} else {
    # No Chrome/Edge found; fall back to a normal tab in the default browser.
    Start-Process $url
}
