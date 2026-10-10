"""Vercel Serverless Function entry point for TenderRadar FastAPI app."""

import os
import sys
from pathlib import Path

# Mark Vercel serverless environment
os.environ.setdefault("VERCEL", "1")

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app
