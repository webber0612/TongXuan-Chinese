import sys
from pathlib import Path


def test_deterministic_final_product_smoke():
    repo_root = Path(__file__).resolve().parent.parent.parent
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    from scripts.final_smoke import run_smoke
    result = run_smoke()
    assert result["status"] == "PASS"
    assert result["read_only_verified"] is True

