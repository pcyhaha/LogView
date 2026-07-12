@echo off
setlocal
cd /d %~dp0

echo [LogView] Cleaning build/runtime caches and intermediate artifacts...
echo.

REM --- 1. stale root packaging log ---
if exist build_pkg.log (
  del /f /q build_pkg.log
  echo   removed build_pkg.log
)

REM --- 2. electron-builder unpacked intermediate dir (rebuilt on package) ---
if exist dist\win-unpacked (
  rmdir /s /q dist\win-unpacked
  echo   removed dist\win-unpacked\
)

REM --- 3. electron-builder debug output ---
if exist dist\builder-debug.yml (
  del /f /q dist\builder-debug.yml
  echo   removed dist\builder-debug.yml
)

REM --- 4. vite compile cache ---
if exist node_modules\.cache (
  rmdir /s /q node_modules\.cache
  echo   removed node_modules\.cache\
)

REM --- 5. logs and diagnostic temp files (keep .gitkeep) ---
if exist log (
  for %%f in (log\*.log log\_*.txt) do del /f /q "%%f" >nul 2>&1
  echo   cleaned log\ (*.log, _*.txt; kept .gitkeep)
)

REM --- optional: deep clean node_modules (requires reinstall) ---
if /i "%~1"=="--deep" (
  if exist node_modules (
    rmdir /s /q node_modules
    echo   removed node_modules\ (reinstall: npm install + ELECTRON_MIRROR)
  )
)

echo.
echo [LogView] Done. Kept: dist\logview-1.0.0-portable.exe, src\, configs, .git\
if /i not "%~1"=="--deep" (
  echo [LogView] Tip: run "clean.bat --deep" to also remove node_modules\ for max space.
)
endlocal
