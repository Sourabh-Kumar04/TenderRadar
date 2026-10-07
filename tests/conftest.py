"""Pytest global configuration ensuring offline mock mode for all tests."""

import os

# Guarantee test suite runs completely offline with zero API keys required
os.environ["MOCK_SERPAPI"] = "1"
os.environ["MOCK_LLM"] = "1"
