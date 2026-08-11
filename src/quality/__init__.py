"""src.quality — Phase 9 data-quality checks for the processed layer."""

from src.quality.checks import CheckResult, run_checks
from src.quality.report import build_report, render_markdown, render_json

__all__ = [
    "CheckResult",
    "run_checks",
    "build_report",
    "render_markdown",
    "render_json",
]
