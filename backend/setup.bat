@echo off
echo === DataFlow Backend Setup ===
cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo Installing core libraries...
pip install -r requirements.txt

if not exist .env (
    echo Creating .env from example...
    copy .env.example .env
)

echo.
echo === Done ===
echo Next: venv\Scripts\activate
echo Then:  uvicorn app.main:app --reload --port 8000
echo API docs: http://localhost:8000/docs
pause
