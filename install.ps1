#Requires -Version 5.1
param(
  [switch]$NoModifyPath
)

$ErrorActionPreference = 'Stop'

$InstallDir = if ($env:ARCHON_UI_INSTALL_DIR) { $env:ARCHON_UI_INSTALL_DIR } else { "$HOME\.archon\tools\archon-task-ui" }
$BinDir = "$HOME\.archon\bin"
$BinFile = "$BinDir\archon-ui.cmd"
$RepoUrl = "https://github.com/KuroXI/archon-task-ui"

Write-Host "Installing Archon Task UI (Windows)..."

# Clone or update
if (Test-Path "$InstallDir\.git") {
  Write-Host "Updating existing install at $InstallDir"
  git -C $InstallDir pull --ff-only
} else {
  Write-Host "Cloning to $InstallDir"
  git clone $RepoUrl $InstallDir
}

# Install dependencies
Write-Host "Installing dependencies..."
Push-Location $InstallDir
bun install --frozen-lockfile
Pop-Location

# Write bin wrapper
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Set-Content -Path $BinFile -Value "@echo off`r`nbun run `"$InstallDir\src\index.tsx`" %*"

if (-not $NoModifyPath) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($userPath -notlike "*\.archon\bin*") {
    [Environment]::SetEnvironmentVariable('Path', "$BinDir;$userPath", 'User')
    Write-Host "  Added $BinDir to user PATH"
  } else {
    Write-Host "  PATH already contains .archon\bin"
  }
}

Write-Host ""
Write-Host "Done! Open a new terminal, then run: archon-ui"
Write-Host ""
Write-Host "To update later: run install.ps1 again"
