"""
Production WSGI entry point for NorthEastRiskAI Flask API.
Use with Gunicorn (Linux) or Waitress (Windows):
    waitress-serve --port=5050 backend.wsgi:app
    gunicorn -w 4 -b 0.0.0.0:5050 backend.wsgi:app
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR / "ml"))

from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
