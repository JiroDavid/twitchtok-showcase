@echo off
cd /d "%~dp0"
py -3 --version >nul 2>nul
if not errorlevel 1 (
    py -3 launcher\launcher.py
) else (
    python launcher\launcher.py
)
if errorlevel 1 (
    echo.
    echo Launcher exited with an error.
    echo If Python is missing, run install-prereqs.bat first - right-click,
    echo "Run as administrator" - then open a new window and try again.
    pause
)
