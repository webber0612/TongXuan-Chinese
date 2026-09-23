def test_deterministic_final_product_smoke():
    from scripts.final_smoke import run_smoke
    result = run_smoke()
    assert result["status"] == "PASS"
    assert result["read_only_verified"] is True
