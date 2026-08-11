#!/usr/bin/env python3
"""CLI entry point for the ETL pipeline.

Usage:  .venv/bin/python scripts/run_etl.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.run import main  # noqa: E402

if __name__ == "__main__":
    main()
