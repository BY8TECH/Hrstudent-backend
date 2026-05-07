@echo off
echo.
echo ========================================
echo   Restarting HR Backend Server
echo ========================================
echo.
echo Stopping any running backend servers...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq npm*" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting backend server...
echo.
cd /d "%~dp0"
npm run dev
