@echo off
REM Double-click launcher for run.ps1 (bypasses PowerShell execution policy).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
pause
