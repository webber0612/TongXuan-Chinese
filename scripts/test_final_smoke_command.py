"""Command-level regression for the canonical Phase 20 smoke invocation."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# This is an explicitly invoked command regression, not part of the backend pytest count.
__test__ = False


def test_root_smoke_command_without_pythonpath() -> None:
    root = Path(__file__).resolve().parents[1]
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    result = subprocess.run(
        [sys.executable, "scripts/final_smoke.py"],
        cwd=root,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "'status': 'PASS'" in result.stdout


if __name__ == "__main__":
    test_root_smoke_command_without_pythonpath()
    print("final_smoke_root_command: PASS")
