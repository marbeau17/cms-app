"""
Vercel Serverless Function entry point.
Imports the FastAPI app from backend/main.py.
Vercel's Python runtime auto-detects the ASGI `app` object.
"""
import sys
import os

# Add backend directory to Python path so we can import main.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app  # noqa: E402 — path must be set before import
