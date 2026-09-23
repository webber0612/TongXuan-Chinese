from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, initialize_database


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def ensure_child(connection: sqlite3.Connection, child_id: int) -> None:
    if connection.execute("SELECT 1 FROM children WHERE id = ?", (child_id,)).fetchone() is None:
        raise ValueError("child_not_found")


def create_child(name: str) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        cursor = db.execute("INSERT INTO children (name) VALUES (?)", (name.strip(),))
        return {"id": cursor.lastrowid, "name": name.strip()}


def list_children(child_ids: set[int] | None = None) -> list[dict[str, Any]]:
    initialize_database()
    with connect() as db:
        if child_ids is None:
            return [dict(row) for row in db.execute("SELECT id, name, created_at FROM children ORDER BY id")]
        if not child_ids:
            return []
        placeholders = ",".join("?" for _ in child_ids)
        return [dict(row) for row in db.execute(f"SELECT id, name, created_at FROM children WHERE id IN ({placeholders}) ORDER BY id", tuple(sorted(child_ids)))]


def seed_learning_items(child_id: int, characters: list[str] | None = None) -> list[dict[str, Any]]:
    initialize_database()
    characters = characters or ["學", "学", "國", "国"]
    with connect() as db:
        ensure_child(db, child_id)
        for character in characters:
            db.execute(
                "INSERT OR IGNORE INTO learning_items (id, child_id, character, curriculum_source, provenance_status, commercial_ready) VALUES (?, ?, ?, ?, ?, ?)",
                (uid("item"), child_id, character, "PHASE_0_SAMPLE", "LICENSE_REVIEW_REQUIRED", 0),
            )
        return [dict(row) for row in db.execute("SELECT * FROM learning_items WHERE child_id = ? ORDER BY id", (child_id,))]


def start_session(child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        session_id = uid("session")
        db.execute("INSERT INTO learning_sessions (id, child_id) VALUES (?, ?)", (session_id, child_id))
        return {"id": session_id, "child_id": child_id}


def next_recognition_item(child_id: int, session_id: str) -> dict[str, Any] | None:
    with connect() as db:
        ensure_child(db, child_id)
        if db.execute("SELECT 1 FROM learning_sessions WHERE id = ? AND child_id = ?", (session_id, child_id)).fetchone() is None:
            raise ValueError("session_not_found")
        row = db.execute(
            """SELECT i.id, i.character, i.curriculum_source, COALESCE(s.correct_count,0) correct_count,
               COALESCE(s.incorrect_count,0) incorrect_count, COALESCE(s.assisted_count,0) assisted_count
               FROM learning_items i LEFT JOIN recognition_states s ON s.item_id=i.id AND s.child_id=i.child_id
               WHERE i.child_id=?
                 AND COALESCE(s.due_at, CURRENT_TIMESTAMP) <= CURRENT_TIMESTAMP
                 AND NOT EXISTS (SELECT 1 FROM recognition_attempts a WHERE a.session_id=? AND a.item_id=i.id)
               ORDER BY COALESCE(s.due_at, CURRENT_TIMESTAMP), i.id LIMIT 1""", (child_id, session_id)
        ).fetchone()
        return dict(row) if row else None


def record_attempt(child_id: int, session_id: str, item_id: str, result: str, assisted: bool, source_queue: str, response_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    if result not in {"correct", "incorrect"}:
        raise ValueError("result_must_be_correct_or_incorrect")
    with connect() as db:
        ensure_child(db, child_id)
        item = db.execute("SELECT 1 FROM learning_items WHERE id=? AND child_id=?", (item_id, child_id)).fetchone()
        session = db.execute("SELECT 1 FROM learning_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if item is None or session is None:
            raise ValueError("child_item_or_session_not_found")
        attempt_id = uid("attempt")
        db.execute("INSERT INTO recognition_attempts (id, child_id, item_id, result, assisted, source_queue, session_id, response_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (attempt_id, child_id, item_id, result, int(assisted), source_queue, session_id, json.dumps(response_metadata or {}, ensure_ascii=False)))
        if result == "incorrect":
            db.execute(
                """INSERT OR IGNORE INTO review_queue_items
                   (id, child_id, item_id, character, source_detail, reason, priority)
                   SELECT ?, child_id, id, character, ?, ?, 10 FROM learning_items WHERE id=?""",
                (uid("review"), "Recognition incorrect", "Recognition incorrect", item_id),
            )
        delay = 0 if result == "incorrect" or assisted else 1
        db.execute("""INSERT INTO recognition_states (child_id,item_id,correct_count,incorrect_count,assisted_count,last_result,due_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(child_id,item_id) DO UPDATE SET
          correct_count=correct_count+excluded.correct_count, incorrect_count=incorrect_count+excluded.incorrect_count,
          assisted_count=assisted_count+excluded.assisted_count,last_result=excluded.last_result,due_at=excluded.due_at,updated_at=excluded.updated_at""",
          (child_id, item_id, int(result == "correct" and not assisted), int(result == "incorrect"), int(assisted), result, (datetime.now(timezone.utc) + timedelta(days=delay)).strftime("%Y-%m-%d %H:%M:%S"), now()))
        return dict(db.execute("SELECT * FROM recognition_attempts WHERE id=?", (attempt_id,)).fetchone())


def finish_session(child_id: int, session_id: str) -> dict[str, Any]:
    with connect() as db:
        session = db.execute("SELECT * FROM learning_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("session_not_found")
        if session["ended_at"] is not None:
            raise ValueError("session_already_completed")
        count = db.execute("SELECT COUNT(*) n FROM recognition_attempts WHERE session_id=? AND child_id=?", (session_id, child_id)).fetchone()["n"]
        if count == 0:
            raise ValueError("session_has_no_attempts")
        db.execute("UPDATE learning_sessions SET ended_at=? WHERE id=? AND child_id=?", (now(), session_id, child_id))
        award_points(db, child_id, "SESSION_COMPLETE", 5, session_id, f"session:{session_id}", "Completed recognition session")
        return {"session_id": session_id, "attempts": count}


def add_school_item(child_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    if (payload.get("source_type", "USER_PROVIDED_SCHOOL_CONTENT") != "USER_PROVIDED_SCHOOL_CONTENT" or
            payload.get("private_content") is not True or payload.get("provenance_status") != "PRIVATE_OK" or
            payload.get("public_curriculum_reuse", False) or payload.get("commercial_reuse", False)):
        raise ValueError("school_queue_private_provenance_required")
    with connect() as db:
        ensure_child(db, child_id)
        item_id = uid("school")
        db.execute("INSERT INTO school_queue_items (id,child_id,character,school_source,due_date,priority,notes,private_content,provenance_status) VALUES (?,?,?,?,?,?,?,?,?)", (item_id, child_id, payload["character"], payload["school_source"], payload.get("due_date"), int(payload.get("priority", 0)), payload.get("notes", ""), int(payload.get("private_content", True)), payload.get("provenance_status", "PRIVATE_OK")))
        result = dict(db.execute("SELECT * FROM school_queue_items WHERE id=?", (item_id,)).fetchone())
        result["source_type"] = "USER_PROVIDED_SCHOOL_CONTENT"
        result["public_curriculum_reuse"] = False
        result["commercial_reuse"] = False
        return result


def list_daily_queue(child_id: int) -> list[dict[str, Any]]:
    with connect() as db:
        ensure_child(db, child_id)
        curriculum = [dict(row) | {"source": "CURRICULUM"} for row in db.execute("SELECT id, character, curriculum_source AS source_detail, 0 AS priority FROM learning_items WHERE child_id=? ORDER BY id", (child_id,))]
        school = [dict(row) | {"source": "SCHOOL_QUEUE"} for row in db.execute("SELECT id, character, school_source AS source_detail, priority FROM school_queue_items WHERE child_id=? AND active=1 AND completed=0 ORDER BY priority DESC, due_date, id", (child_id,))]
        review = [dict(row) | {"source": "REVIEW"} for row in db.execute("SELECT id, character, source_detail, priority FROM review_queue_items WHERE child_id=? AND active=1 ORDER BY priority DESC, created_at, id", (child_id,))]
        return school + review + curriculum


def create_weekly_test(child_id: int) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        rows = db.execute(
            """SELECT i.id, i.character FROM learning_items i
               LEFT JOIN recognition_states s ON s.item_id=i.id AND s.child_id=i.child_id
               WHERE i.child_id=?
               ORDER BY CASE WHEN COALESCE(s.correct_count,0)>0 THEN 0 ELSE 1 END,
                        CASE WHEN COALESCE(s.updated_at, i.created_at)>=? THEN 0 ELSE 1 END,
                        COALESCE(s.updated_at, i.created_at) DESC, i.id
               LIMIT 5""", (child_id, cutoff)
        ).fetchall()
        test_id = uid("test")
        item_ids = [dict(row) for row in rows]
        db.execute("INSERT INTO weekly_tests (id,child_id,item_ids,total) VALUES (?,?,?,?)", (test_id, child_id, json.dumps(item_ids, ensure_ascii=False), len(item_ids)))
        return {"id": test_id, "child_id": child_id, "items": item_ids, "total": len(item_ids)}


def submit_weekly_test(child_id: int, test_id: str, answers: dict[str, str]) -> dict[str, Any]:
    with connect() as db:
        row = db.execute("SELECT * FROM weekly_tests WHERE id=? AND child_id=?", (test_id, child_id)).fetchone()
        if row is None:
            raise ValueError("test_not_found")
        if row["completed_at"] is not None:
            raise ValueError("weekly_test_already_completed")
        items = json.loads(row["item_ids"])
        correctness = {item["id"]: answers.get(item["id"]) == item["character"] for item in items}
        score = sum(correctness.values())
        db.execute("UPDATE weekly_tests SET submitted_answers=?,correctness=?,score=?,completed_at=? WHERE id=?", (json.dumps(answers, ensure_ascii=False), json.dumps(correctness), score, now(), test_id))
        for item in items:
            if not correctness[item["id"]]:
                db.execute(
                    """INSERT OR IGNORE INTO review_queue_items
                       (id, child_id, item_id, character, source_detail, reason, priority)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (uid("review"), child_id, item["id"], item["character"], "Weekly Test", "Weekly Test missed item", 10),
                )
        award_points(db, child_id, "WEEKLY_TEST_COMPLETE", 10, test_id, f"weekly-test:{test_id}", "Completed weekly test")
        return {"id": test_id, "score": score, "total": len(items), "correctness": correctness, "missed_items": [item["character"] for item in items if not correctness[item["id"]]]}


def award_points(db: sqlite3.Connection, child_id: int, event_type: str, delta: int, related: str, event_key: str, reason: str) -> bool:
    cursor = db.execute("INSERT OR IGNORE INTO points_ledger (id,child_id,event_type,points_delta,related_entity,event_key,reason) VALUES (?,?,?,?,?,?,?)", (uid("points"), child_id, event_type, delta, related, event_key, reason))
    return cursor.rowcount == 1


def points_summary(child_id: int) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        db.execute("INSERT OR IGNORE INTO reward_catalog (id,name,cost) VALUES ('reward_special_time','Special family time',20)")
        ledger = [dict(row) for row in db.execute("SELECT * FROM points_ledger WHERE child_id=? ORDER BY timestamp,id", (child_id,))]
        balance = sum(row["points_delta"] for row in ledger)
        rewards = [dict(row) for row in db.execute("SELECT * FROM reward_catalog WHERE active=1 ORDER BY cost")]
        return {"child_id": child_id, "balance": balance, "ledger": ledger, "rewards": rewards}


def redeem_reward(child_id: int, reward_id: str) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        reward = db.execute("SELECT * FROM reward_catalog WHERE id=? AND active=1", (reward_id,)).fetchone()
        if reward is None:
            raise ValueError("reward_not_found")
        balance = db.execute("SELECT COALESCE(SUM(points_delta),0) balance FROM points_ledger WHERE child_id=?", (child_id,)).fetchone()["balance"]
        if balance < reward["cost"]:
            raise ValueError("insufficient_balance")
        redemption_id = uid("redemption")
        db.execute("INSERT INTO reward_redemptions (id,child_id,reward_id,cost) VALUES (?,?,?,?)", (redemption_id, child_id, reward_id, reward["cost"]))
        award_points(db, child_id, "REWARD_REDEMPTION", -reward["cost"], redemption_id, f"redemption:{redemption_id}", f"Redeemed {reward['name']}")
        return {"id": redemption_id, "reward_id": reward_id, "cost": reward["cost"]}
