#!/usr/bin/env bash
# DragonCard one-command launcher (macOS / Linux)
# Creates a venv if needed, installs deps, and starts the app.
set -e
cd "$(dirname "$0")"

PY=python3
command -v "$PY" >/dev/null 2>&1 || { echo "Error: Python 3 is required (https://python.org)"; exit 1; }

# Create venv on first run
if [ ! -d venv ]; then
    echo "==> Creating virtual environment..."
    "$PY" -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

echo "==> Installing dependencies..."
pip install --quiet -r requirements.txt

echo "==> Starting DragonCard..."
echo "    Open http://localhost:5001 in your browser"
python app.py