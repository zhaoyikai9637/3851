@echo off
cd /d "%~dp0"
echo Starting the local HR API. Keep this window open while using the website.
call npm.cmd run dev -w server
pause
