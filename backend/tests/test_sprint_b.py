from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "sprint_b.sqlite3")
    from app.main import app
    return TestClient(app)


def seed(api: TestClient):
    child = api.post("/api/children", json={"name": "Alice"}).json()
    other = api.post("/api/children", json={"name": "Bob"}).json()
    assert api.post("/api/sprint-b/seed", params={"child_id": child["id"]}).status_code == 200
    return child["id"], other["id"]


def test_phase5_words_sentences_linkage_provenance_and_isolation(tmp_path):
    with client(tmp_path) as api:
        child_id, other_id = seed(api)
        words = api.get("/api/sprint-b/words", params={"child_id": child_id}).json()
        sentences = api.get("/api/sprint-b/sentences", params={"child_id": child_id}).json()
        assert words and sentences
        assert all(item["provenance_status"] == "LICENSE_REVIEW_REQUIRED" for item in words)
        assert api.get("/api/sprint-b/words", params={"child_id": other_id}).json() == []
        state = api.post(f"/api/sprint-b/words/{words[0]['id']}/attempts", params={"child_id": child_id}, json={"result": "correct"}).json()
        assisted = api.post(f"/api/sprint-b/words/{words[0]['id']}/attempts", params={"child_id": child_id}, json={"result": "correct", "assisted": True}).json()
        assert state["correct_count"] == 1 and assisted["assisted_count"] == 1


def test_phase6_writing_is_separate_and_assisted_not_independent(tmp_path):
    with client(tmp_path) as api:
        child_id, _ = seed(api)
        first = api.post("/api/sprint-b/writing/attempts", params={"child_id": child_id, "character": "學"}, json={"trace_result": "correct"}).json()
        second = api.post("/api/sprint-b/writing/attempts", params={"child_id": child_id, "character": "學"}, json={"trace_result": "correct", "assisted": True}).json()
        assert first["independent_success_count"] == 1
        assert second["independent_success_count"] == 1 and second["assisted_count"] == 1


def test_phase7_multiple_readings_and_system_separation(tmp_path):
    with client(tmp_path) as api:
        child_id, _ = seed(api)
        readings = api.get("/api/sprint-b/pronunciation", params={"character": "學"}).json()
        assert {item["notation_system"] for item in readings} == {"ZHUYIN", "PINYIN"}
        assert len([item for item in readings if item["notation_system"] == "PINYIN"]) == 2
        assert api.post(f"/api/sprint-b/pronunciation/{readings[0]['id']}/attempts", params={"child_id": child_id}, json={"answer": readings[0]["notation"]}).json()["correct"] is True
        other = next(item for item in readings if item["id"] != readings[0]["id"])
        assert api.post(f"/api/sprint-b/pronunciation/{other['id']}/attempts", params={"child_id": child_id}, json={"answer": "wrong"}).json()["correct"] is False


def test_phase8_deterministic_grammar_assisted_and_isolation(tmp_path):
    with client(tmp_path) as api:
        child_id, other_id = seed(api)
        exercise = api.get("/api/sprint-b/grammar").json()[0]
        assert api.post(f"/api/sprint-b/grammar/{exercise['id']}/attempts", params={"child_id": child_id}, json={"answer": exercise["answer_rule"]}).json()["correct"] is True
        assisted = api.post(f"/api/sprint-b/grammar/{exercise['id']}/attempts", params={"child_id": child_id}, json={"answer": exercise["answer_rule"], "assisted": True}).json()
        assert assisted["state"]["correct_count"] == 1 and assisted["state"]["assisted_count"] == 1
        assert api.post(f"/api/sprint-b/grammar/{exercise['id']}/attempts", params={"child_id": other_id}, json={"answer": exercise["answer_rule"]}).status_code == 200
        assert assisted["state"]["correct_count"] == 1


def test_phase9_idiom_linkage_state_separation_and_scoring(tmp_path):
    with client(tmp_path) as api:
        child_id, _ = seed(api)
        idiom = api.get("/api/sprint-b/idioms").json()[0]
        assert api.post(f"/api/sprint-b/idioms/{idiom['id']}/attempts", params={"child_id": child_id}, json={"answer": idiom["meaning"]}).json()["correct"] is True
        result = api.post(f"/api/sprint-b/idioms/{idiom['id']}/attempts", params={"child_id": child_id}, json={"answer": "wrong"}).json()
        assert result["state"]["correct_count"] == 1 and result["state"]["incorrect_count"] == 1


def test_phase10_reproducible_reading_scoring_state_and_provenance(tmp_path):
    with client(tmp_path) as api:
        child_id, other_id = seed(api)
        passages = api.get("/api/sprint-b/reading/passages", params={"child_id": child_id}).json()
        passage = passages[0]
        assert passage["provenance_status"] == "LICENSE_REVIEW_REQUIRED"
        result = api.post(f"/api/sprint-b/reading/passages/{passage['id']}/attempts", params={"child_id": child_id}, json={"answers": {passage["question_id"]: passage["answer_rule"]}})
        assert result.status_code == 200 and result.json()["score"] == 1
        assert api.get("/api/sprint-b/reading/passages", params={"child_id": other_id}).json() == []
