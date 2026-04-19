#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$InstallDir = if ($env:ARCHON_UI_INSTALL_DIR) { $env:ARCHON_UI_INSTALL_DIR } else { "$HOME\.archon\tools\archon-task-ui" }
$BinDir = "$HOME\.archon\bin"
$BinFile = "$BinDir\archon-ui.cmd"

Write-Host "Uninstalling Archon Task UI (Windows)..."

# Remove install dir
if (Test-Path $InstallDir) {
  Remove-Item -Recurse -Force $InstallDir
  Write-Host "  Removed $InstallDir"
} else {
  Write-Host "  Install dir not found: $InstallDir"
}

# Remove bin file
if (Test-Path $BinFile) {
  Remove-Item -Force $BinFile
  Write-Host "  Removed $BinFile"
}

# Remove from user PATH
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -like "*\.archon\bin*") {
  $newPath = ($userPath -split ';' | Where-Object { $_ -notlike "*\.archon\bin*" }) -join ';'
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "  Removed $BinDir from user PATH"
} else {
  Write-Host "  PATH did not contain .archon\bin"
}

# Remove bin dir if empty
if ((Test-Path $BinDir) -and (Get-ChildItem $BinDir -Force | Measure-Object).Count -eq 0) {
  Remove-Item $BinDir
  Write-Host "  Removed empty $BinDir"
}

Write-Host ""
Write-Host "Done! Archon Task UI uninstalled."
Write-Host "Open a new terminal to apply PATH changes."
