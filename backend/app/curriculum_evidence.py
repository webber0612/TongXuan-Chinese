"""Append-only evidence for mastery requirements that have no reliable scorer."""

from __future__ import annotations

from typing import Any

NON_SCORE_GATE_DOMAINS = {"listening", "speaking", "writing", "pronunciation"}
GATE_STATUSES = {"ATTEMPTED_INDEPENDENTLY", "PARENT_VERIFIED"}
SCORED_DOMAINS = {"recognition", "reading", "phonetics", "vocabulary", "grammar"}


def record_linked_score_evidence(
    db: Any,
    *,
    child_id: int,
    skill_domain: str,
    item_id: str,
    score: float,
    assisted: bool,
    evidence_ref: str,
    evidence_type: str,
    script_mode: str | None = None,
) -> str | None:
    """Persist a scorer-issued result once, keeping non-score gates elsewhere."""
    if skill_domain not in SCORED_DOMAINS or not 0 <= float(score) <= 1:
        raise ValueError("invalid_scored_evidence")
    link = db.execute(
        "SELECT lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain=? AND item_id=?",
        (child_id, skill_domain, item_id),
    ).fetchone()
    if link is None:
        return None
    existing = db.execute(
        "SELECT id FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain=? AND evidence_ref=?",
        (child_id, skill_domain, evidence_ref),
    ).fetchone()
    if existing:
        return existing["id"]

    from .learning import now, uid

    evidence_id = uid("skill-evidence")
    db.execute(
        "INSERT INTO curriculum_skill_evidence(id,child_id,lesson_id,skill_domain,script_mode,score,assisted,evidence_ref,evidence_type,evidence_item_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (evidence_id, child_id, link["lesson_id"], skill_domain, script_mode, float(score), int(assisted), evidence_ref, evidence_type, item_id, now()),
    )
    return evidence_id


def record_linked_skill_gate(
    db: Any,
    *,
    child_id: int,
    skill_domain: str,
    item_id: str,
    evidence_ref: str,
    evidence_type: str,
    gate_status: str = "ATTEMPTED_INDEPENDENTLY",
    assisted: bool = False,
    lesson_id: str | None = None,
) -> str | None:
    """Link an actual completed activity to a lesson without inventing a score."""
    if skill_domain not in NON_SCORE_GATE_DOMAINS or gate_status not in GATE_STATUSES:
        raise ValueError("invalid_non_score_gate")
    if assisted and gate_status == "ATTEMPTED_INDEPENDENTLY":
        return None
    query = "SELECT lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain=? AND item_id=?"
    args: tuple[Any, ...] = (child_id, skill_domain, item_id)
    if lesson_id is not None:
        query += " AND lesson_id=?"
        args += (lesson_id,)
    link = db.execute(query, args).fetchone()
    if link is None:
        return None

    from .learning import now, uid

    gate_id = uid("skill-gate")
    db.execute(
        """INSERT OR IGNORE INTO curriculum_skill_gates
           (id,child_id,lesson_id,skill_domain,gate_status,assisted,evidence_ref,evidence_type,evidence_item_id,created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?)""",
        (gate_id, child_id, link["lesson_id"], skill_domain, gate_status, int(assisted), evidence_ref, evidence_type, item_id, now()),
    )
    row = db.execute(
        "SELECT id FROM curriculum_skill_gates WHERE child_id=? AND skill_domain=? AND evidence_ref=?",
        (child_id, skill_domain, evidence_ref),
    ).fetchone()
    return row["id"] if row else None
