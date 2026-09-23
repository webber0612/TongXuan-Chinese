from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "dashboard.sqlite3")
    from app.main import app
    return TestClient(app)


def test_dashboard_is_child_scoped_event_based_and_read_only(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        api.post(f"/api/children/{alice}/learning-items/seed", json={"characters": ["學"]})
        session = api.post("/api/recognition/sessions", params={"child_id": alice}).json()["id"]
        item = api.get(f"/api/recognition/sessions/{session}/next", params={"child_id": alice}).json()["item"]
        api.post(f"/api/recognition/sessions/{session}/attempts", params={"child_id": alice}, json={"item_id": item["id"], "result": "correct", "assisted": False})
        api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學", "school_source": "Private worksheet", "due_date": "2099-01-01"})
        before = api.get("/api/dashboard", params={"child_id": alice, "window": "all", "to_at": "2099-01-02T00:00:00Z"}).json()
        after = api.get("/api/dashboard", params={"child_id": bob, "window": "all", "to_at": "2099-01-02T00:00:00Z"}).json()
        assert before["child"]["name"] == "Alice"
        assert before["skills"]["recognition"]["independent_correct"] == 1
        assert before["skills"]["recognition"]["incorrect"] == 0
        assert before["school_queue"]["active"] == 1
        assert after["activity"]["attempts"]["attempts"] == 0
        assert after["school_queue"]["active"] == 0
        assert before["read_only"] is True


def test_dashboard_windows_and_skills_remain_separate(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/sprint-b/seed", params={"child_id": child_id})
        dashboard = api.get("/api/dashboard", params={"child_id": child_id, "window": "30d"}).json()
        assert set(dashboard["skills"]) == {"recognition", "writing", "word", "sentence", "pronunciation", "grammar", "idiom", "reading", "reading_aloud"}
        assert dashboard["window"]["name"] == "30d"
        assert "balance" in dashboard["points_rewards"]
        assert {"candidates", "confirmed", "items"} <= set(dashboard["ocr"])
        assert {"attempts", "completed", "aborted", "items"} <= set(dashboard["reading_aloud"])


def test_dashboard_rejects_invalid_window_and_unknown_child(tmp_path):
    with client(tmp_path) as api:
        assert api.get("/api/dashboard", params={"child_id": 999, "window": "7d"}).json()["detail"] == "child_not_found"
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        assert api.get("/api/dashboard", params={"child_id": child_id, "window": "bad"}).json()["detail"] == "invalid_window"


def test_dashboard_keeps_reading_aloud_out_of_correctness_totals(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect
        with connect() as db:
            db.execute("INSERT INTO reading_aloud_attempts (id,child_id,source_type,text_snapshot,text_kind,locale,started_at,completed_at,status) VALUES (?,?,?,?,?,?,?,?,?)", ("aloud-complete", child_id, "TRANSIENT_TEXT", "學", "character", "zh-TW", "2026-01-01 10:00:00", "2026-01-01 10:00:10", "COMPLETED"))
            db.execute("INSERT INTO reading_aloud_attempts (id,child_id,source_type,text_snapshot,text_kind,locale,started_at,aborted_at,status) VALUES (?,?,?,?,?,?,?,?,?)", ("aloud-abort", child_id, "TRANSIENT_TEXT", "學", "character", "zh-TW", "2026-01-01 11:00:00", "2026-01-01 11:00:10", "ABORTED"))
        result = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z"}).json()
        assert result["activity"]["attempts"]["correct"] == 0
        assert result["activity"]["attempts"]["incorrect"] == 0
        assert result["activity"]["attempts"]["independent_correct"] == 0
        assert result["skills"]["reading_aloud"]["completed"] == 1
        assert result["skills"]["reading_aloud"]["aborted"] == 1


def test_dashboard_weekly_history_uses_completed_at_and_review_is_historical_as_of(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect
        with connect() as db:
            db.execute("INSERT INTO learning_items (id,child_id,character,curriculum_source,provenance_status,commercial_ready) VALUES (?,?,?,?,?,?)", ("missing-item", child_id, "學", "TEST", "PRIVATE_OK", 0))
            db.execute("INSERT INTO weekly_tests (id,child_id,item_ids,correctness,score,total,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?)", ("test-completed", child_id, "[]", '{"item": true}', 1, 1, "2025-12-01 00:00:00", "2026-01-05 00:00:00"))
            db.execute("INSERT INTO weekly_tests (id,child_id,item_ids,total,created_at) VALUES (?,?,?,?,?)", ("test-pending", child_id, "[]", 1, "2026-01-04 00:00:00"))
            db.execute("INSERT INTO review_queue_items (id,child_id,item_id,character,source_detail,reason,created_at) VALUES (?,?,?,?,?,?,?)", ("review-old", child_id, "missing-item", "學", "old", "miss", "2025-01-01 00:00:00"))
        first = api.get("/api/dashboard", params={"child_id": child_id, "window": "7d", "to_at": "2026-01-06T00:00:00Z"}).json()
        assert [entry["id"] for entry in first["weekly_tests"]["history"]] == ["test-completed"]
        assert first["weekly_tests"]["recent"]["id"] == "test-completed"
        assert [entry["id"] for entry in first["weekly_tests"]["pending"]] == ["test-pending"]
        assert first["activity"]["review_count"] == 1
        with connect() as db:
            db.execute("UPDATE review_queue_items SET active=0,deactivated_at=? WHERE id=?", ("2026-01-05 00:00:00", "review-old"))
        before_deactivation = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-04T00:00:00Z"}).json()
        after_deactivation = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-06T00:00:00Z"}).json()
        assert before_deactivation["activity"]["review_count"] == 1
        assert after_deactivation["activity"]["review_count"] == 0


def test_dashboard_replays_ocr_confirmation_as_of_without_future_fields(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        created = api.post(
            "/api/ocr/imports/candidate",
            params={"child_id": child_id},
            json={"image_name": "worksheet.jpg", "source_label": "T1 worksheet", "candidate_hint": "學"},
        ).json()
        api.post(
            f"/api/ocr/imports/{created['id']}/confirm",
            params={"child_id": child_id},
            json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"},
        )
        from app.database import connect
        with connect() as db:
            db.execute("UPDATE ocr_imports SET created_at=?,confirmed_at=? WHERE id=?", ("2026-01-01 10:00:00", "2026-01-03 10:00:00", created["id"]))
        t2 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z"}).json()
        t4 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-04T00:00:00Z"}).json()
        old = t2["ocr"]["items"][0]
        new = t4["ocr"]["items"][0]
        assert t2["ocr"]["candidates"] == 1
        assert t2["ocr"]["confirmed"] == 0
        assert old["review_status"] == "CANDIDATE"
        assert old["confirmed_text"] is None
        assert old["locale"] is None
        assert old["script"] is None
        assert old["school_queue_item_id"] is None
        assert t4["ocr"]["confirmed"] == 1
        assert new["review_status"] == "CONFIRMED"
        assert new["confirmed_text"] == "學"
        assert new["locale"] == "zh-TW"
        assert new["script"] == "TRADITIONAL"
        assert new["school_queue_item_id"] is not None


def test_dashboard_replays_reading_aloud_complete_and_abort_as_of(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect
        with connect() as db:
            db.execute(
                "INSERT INTO reading_aloud_attempts (id,child_id,source_type,text_snapshot,text_kind,locale,started_at,completed_at,status) VALUES (?,?,?,?,?,?,?,?,?)",
                ("aloud-complete-history", child_id, "TRANSIENT_TEXT", "學", "character", "zh-TW", "2026-01-01 10:00:00", "2026-01-03 10:00:00", "COMPLETED"),
            )
            db.execute(
                "INSERT INTO reading_aloud_attempts (id,child_id,source_type,text_snapshot,text_kind,locale,started_at,aborted_at,status) VALUES (?,?,?,?,?,?,?,?,?)",
                ("aloud-abort-history", child_id, "TRANSIENT_TEXT", "國", "character", "zh-TW", "2026-01-01 11:00:00", "2026-01-03 11:00:00", "ABORTED"),
            )
        t2 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z"}).json()
        t4 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-04T00:00:00Z"}).json()
        old = {row["id"]: row for row in t2["reading_aloud"]["items"]}
        new = {row["id"]: row for row in t4["reading_aloud"]["items"]}
        assert t2["reading_aloud"]["completed"] == 0
        assert t2["reading_aloud"]["aborted"] == 0
        assert old["aloud-complete-history"]["status"] == "STARTED"
        assert old["aloud-abort-history"]["status"] == "STARTED"
        assert t2["skills"]["reading_aloud"]["completed"] == 0
        assert t2["skills"]["reading_aloud"]["aborted"] == 0
        assert t4["reading_aloud"]["completed"] == 1
        assert t4["reading_aloud"]["aborted"] == 1
        assert new["aloud-complete-history"]["status"] == "COMPLETED"
        assert new["aloud-abort-history"]["status"] == "ABORTED"
        assert t4["skills"]["reading_aloud"]["completed"] == 1
        assert t4["skills"]["reading_aloud"]["aborted"] == 1


def test_dashboard_replays_weekly_pending_state_as_of(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect
        with connect() as db:
            db.execute(
                "INSERT INTO weekly_tests (id,child_id,item_ids,total,created_at,completed_at,score,correctness) VALUES (?,?,?,?,?,?,?,?)",
                ("test-pending-history", child_id, "[]", 2, "2026-01-01 10:00:00", "2026-01-03 10:00:00", 2, '{"item": true}'),
            )
        t2 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z"}).json()
        t4 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-04T00:00:00Z"}).json()
        assert [row["id"] for row in t2["weekly_tests"]["pending"]] == ["test-pending-history"]
        assert [row["id"] for row in t2["weekly_tests"]["history"]] == []
        assert [row["id"] for row in t4["weekly_tests"]["pending"]] == []
        assert [row["id"] for row in t4["weekly_tests"]["history"]] == ["test-pending-history"]


def test_dashboard_read_does_not_initialize_database_or_run_migrations(tmp_path, monkeypatch):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app import adaptive

        monkeypatch.setattr(adaptive, "initialize_database", lambda: (_ for _ in ()).throw(AssertionError("dashboard read initialized database")))
        response = api.get("/api/dashboard", params={"child_id": child_id, "window": "all"})
        assert response.status_code == 200


def test_dashboard_reconstructs_school_lifecycle_and_ignores_malformed_events(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect

        with connect() as db:
            db.execute(
                "INSERT INTO school_queue_items (id,child_id,character,school_source,created_at,active,completed,completed_at,deactivated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                ("school-future", child_id, "學", "Worksheet", "2026-01-01 10:00:00", 0, 1, "2026-01-03 10:00:00", "2026-01-04 10:00:00"),
            )
            db.execute(
                "INSERT INTO school_queue_items (id,child_id,character,school_source,created_at,active,completed,completed_at,deactivated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                ("school-malformed", child_id, "國", "Worksheet", "2026-01-01 11:00:00", 0, 1, "not-a-time", "2025-12-31 00:00:00"),
            )

        t2 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z"}).json()
        t4 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-05T00:00:00Z"}).json()
        t2_items = {item["id"]: item for item in t2["school_queue"]["items"]}
        t4_items = {item["id"]: item for item in t4["school_queue"]["items"]}

        # Current flags cannot hide a row before its timestamped lifecycle event.
        assert t2["school_queue"]["active"] == 2
        assert t2["school_queue"]["completed"] == 0
        assert t2_items["school-future"]["active"] is True
        assert t2_items["school-future"]["completed"] is False
        # A malformed event and an event before creation are ignored deterministically.
        assert t2_items["school-malformed"]["active"] is True
        assert t2_items["school-malformed"]["completed"] is False
        assert t4["school_queue"]["active"] == 1
        assert t4["school_queue"]["completed"] == 1
        assert t4_items["school-future"]["active"] is False
        assert t4_items["school-future"]["completed"] is True


def test_dashboard_school_review_and_adaptive_share_lifecycle_as_of(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        from app.database import connect

        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? LIMIT 1", (child_id,)).fetchone()[0]
            db.execute(
                "INSERT INTO school_queue_items (id,child_id,character,school_source,created_at,active,completed,completed_at,deactivated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                ("school-lifecycle", child_id, "學", "Worksheet", "2026-01-01 10:00:00", 0, 1, "2026-01-03 10:00:00", None),
            )
            db.execute(
                "INSERT INTO review_queue_items (id,child_id,item_id,character,source_detail,reason,created_at,active,deactivated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                ("review-lifecycle", child_id, item_id, "學", "Review", "wrong", "2026-01-01 10:00:00", 0, "2026-01-03 10:00:00"),
            )

        t2 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-02T00:00:00Z", "adaptive_limit": 50}).json()
        t4 = api.get("/api/dashboard", params={"child_id": child_id, "window": "all", "to_at": "2026-01-04T00:00:00Z", "adaptive_limit": 50}).json()
        t2_sources = {(item["source"], item["source_id"]) for item in t2["activity"]["adaptive"]["items"]}
        t4_sources = {(item["source"], item["source_id"]) for item in t4["activity"]["adaptive"]["items"]}

        # T2 reconstructs both resources as active despite their current flags.
        assert t2["school_queue"]["active"] == 1
        assert t2["activity"]["review_count"] == 1
        assert ("SCHOOL_QUEUE", "school-lifecycle") in t2_sources
        assert ("REVIEW", "review-lifecycle") in t2_sources
        # T4 applies the same T3 lifecycle events to all three views.
        assert t4["school_queue"]["active"] == 0
        assert t4["school_queue"]["completed"] == 1
        assert t4["activity"]["review_count"] == 0
        assert ("SCHOOL_QUEUE", "school-lifecycle") not in t4_sources
        assert ("REVIEW", "review-lifecycle") not in t4_sources
