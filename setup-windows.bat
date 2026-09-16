@echo off
setlocal
cd /d "%~dp0"

echo SecureAsset local setup - no Docker
where node >nul 2>nul || (
  echo ERROR: Node.js is not installed or not available in PATH.
  exit /b 1
)
where npm.cmd >nul 2>nul || (
  echo ERROR: npm is not installed or not available in PATH.
  exit /b 1
)

node scripts\setup-local.js || exit /b 1
call npm.cmd install || exit /b 1
call npm.cmd run db:check || exit /b 1
call npm.cmd run seed || exit /b 1

echo.
echo Setup completed. Run start-windows.bat to launch the app.
endlocal
