@echo off
REM DragonCard one-command launcher (Windows)
REM Creates a venv if needed, installs deps, and starts the app.
cd /d %~dp0

where python >nul 2>nul
if errorlevel 1 (
    echo Error: Python 3 is required (https://python.org)
    pause
    exit /b 1
)

if not exist venv (
    echo ==^> Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo ==^> Installing dependencies...
pip install --quiet -r requirements.txt

echo ==^> Starting DragonCard...
echo     Open http://localhost:5001 in your browser
python app.py

pause