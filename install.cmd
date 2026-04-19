@echo off
setlocal EnableDelayedExpansion

set "INSTALL_DIR=%USERPROFILE%\.archon\tools\archon-task-ui"
set "BIN_DIR=%USERPROFILE%\.archon\bin"
set "BIN_FILE=%BIN_DIR%\archon-ui.cmd"
set "REPO_URL=https://github.com/KuroXI/archon-task-ui"
set "NO_MODIFY_PATH=0"

for %%A in (%*) do (
  if "%%A"=="--no-modify-path" set "NO_MODIFY_PATH=1"
)

echo Installing Archon Task UI (Windows CMD)...

if exist "%INSTALL_DIR%\.git" (
  echo Updating existing install at %INSTALL_DIR%
  git -C "%INSTALL_DIR%" pull --ff-only
) else (
  echo Cloning to %INSTALL_DIR%
  git clone "%REPO_URL%" "%INSTALL_DIR%"
)

echo Installing dependencies...
cd /d "%INSTALL_DIR%"
bun install --frozen-lockfile

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo @echo off > "%BIN_FILE%"
echo bun run "%INSTALL_DIR%\src\index.tsx" %%* >> "%BIN_FILE%"

if "%NO_MODIFY_PATH%"=="1" goto :skip_path

:: Add to user PATH via registry (avoid setx — truncates at 1024 chars)
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "CURRENT_PATH=%%B"
echo !CURRENT_PATH! | findstr /i ".archon\bin" >nul 2>&1
if errorlevel 1 (
  reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "%BIN_DIR%;!CURRENT_PATH!" /f >nul
  echo   Added %BIN_DIR% to user PATH
) else (
  echo   PATH already contains .archon\bin
)

:skip_path
echo.
echo Done! Open a new terminal, then run: archon-ui
echo.
echo To update later: run install.cmd again
endlocal
