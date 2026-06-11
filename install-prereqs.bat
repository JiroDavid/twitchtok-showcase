@echo off
echo === TwitchTok prerequisites installer ===
echo Installs Git, Git LFS, Python 3.11, Node.js LTS and FFmpeg via winget.
echo.

net session >nul 2>nul
if errorlevel 1 (
    echo Please right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

where winget >nul 2>nul
if errorlevel 1 (
    echo winget not found. Update Windows / App Installer first: https://aka.ms/getwinget
    pause
    exit /b 1
)

winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id GitHub.GitLFS -e --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements

echo.
echo Done. Open a NEW terminal so PATH updates apply, then run: git lfs install
echo After that, double-click launcher.bat and press Setup.
pause
