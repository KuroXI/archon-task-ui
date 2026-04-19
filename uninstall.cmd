@echo off
setlocal EnableDelayedExpansion

set "INSTALL_DIR=%USERPROFILE%\.archon\tools\archon-task-ui"
set "BIN_DIR=%USERPROFILE%\.archon\bin"
set "BIN_FILE=%BIN_DIR%\archon-ui.cmd"

echo Uninstalling Archon Task UI (Windows CMD)...

if exist "%INSTALL_DIR%" (
  rmdir /s /q "%INSTALL_DIR%"
  echo   Removed %INSTALL_DIR%
) else (
  echo   Install dir not found: %INSTALL_DIR%
)

if exist "%BIN_FILE%" (
  del /f /q "%BIN_FILE%"
  echo   Removed %BIN_FILE%
)

:: Remove from user PATH via registry
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "CURRENT_PATH=%%B"
echo !CURRENT_PATH! | findstr /i ".archon\bin" >nul 2>&1
if not errorlevel 1 (
  set "NEW_PATH=!CURRENT_PATH:%BIN_DIR%;=!"
  set "NEW_PATH=!NEW_PATH:;%BIN_DIR%=!"
  set "NEW_PATH=!NEW_PATH:%BIN_DIR%=!"
  reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "!NEW_PATH!" /f >nul
  echo   Removed %BIN_DIR% from user PATH
) else (
  echo   PATH did not contain .archon\bin
)

:: Remove bin dir if empty
dir /b "%BIN_DIR%" 2>nul | findstr "." >nul
if errorlevel 1 (
  if exist "%BIN_DIR%" (
    rmdir "%BIN_DIR%"
    echo   Removed empty %BIN_DIR%
  )
)

echo.
echo Done! Archon Task UI uninstalled.
echo Open a new terminal to apply PATH changes.
endlocal
