from __future__ import annotations

import os
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "tongxuan.sqlite3"
SCHEMA_VERSION = 2
SQLITE_BUSY_TIMEOUT_MS = 5000


def database_path() -> Path:
    path = Path(os.getenv("TONGXUAN_DB_PATH", str(DEFAULT_DB_PATH)))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS children (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS diagnostic_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS learning_items (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                character TEXT NOT NULL,
                curriculum_source TEXT NOT NULL,
                provenance_status TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(child_id, character, curriculum_source)
            );
            CREATE TABLE IF NOT EXISTS curriculum_levels (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                source_name TEXT NOT NULL,
                source_url TEXT NOT NULL,
                license_name TEXT NOT NULL,
                provenance_status TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0,
                commercial_action TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS curriculum_units (
                id TEXT PRIMARY KEY,
                level_id TEXT NOT NULL REFERENCES curriculum_levels(id),
                title TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                source_name TEXT NOT NULL,
                source_url TEXT NOT NULL,
                license_name TEXT NOT NULL,
                provenance_status TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0,
                commercial_action TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS curriculum_items (
                id TEXT PRIMARY KEY,
                unit_id TEXT NOT NULL REFERENCES curriculum_units(id),
                item_type TEXT NOT NULL,
                content TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                source_name TEXT NOT NULL,
                source_url TEXT NOT NULL,
                license_name TEXT NOT NULL,
                provenance_status TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0,
                commercial_action TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS curriculum_progress_events (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                curriculum_item_id TEXT NOT NULL REFERENCES curriculum_items(id),
                status TEXT NOT NULL CHECK(status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
                event_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS recognition_states (
                child_id INTEGER NOT NULL REFERENCES children(id),
                item_id TEXT NOT NULL REFERENCES learning_items(id),
                correct_count INTEGER NOT NULL DEFAULT 0,
                incorrect_count INTEGER NOT NULL DEFAULT 0,
                assisted_count INTEGER NOT NULL DEFAULT 0,
                last_result TEXT,
                due_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id, item_id)
            );
            CREATE TABLE IF NOT EXISTS learning_sessions (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT
            );
            CREATE TABLE IF NOT EXISTS recognition_attempts (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                item_id TEXT NOT NULL REFERENCES learning_items(id),
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                result TEXT NOT NULL CHECK(result IN ('correct','incorrect')),
                assisted INTEGER NOT NULL DEFAULT 0,
                source_queue TEXT NOT NULL,
                session_id TEXT NOT NULL REFERENCES learning_sessions(id),
                response_metadata TEXT NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS review_queue_items (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                item_id TEXT NOT NULL REFERENCES learning_items(id),
                character TEXT NOT NULL,
                source_detail TEXT NOT NULL,
                reason TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                deactivated_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(child_id, item_id, source_detail, reason)
            );
            CREATE TABLE IF NOT EXISTS school_queue_items (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                character TEXT NOT NULL,
                school_source TEXT NOT NULL,
                due_date TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                private_content INTEGER NOT NULL DEFAULT 1,
                provenance_status TEXT NOT NULL DEFAULT 'PRIVATE_OK',
                active INTEGER NOT NULL DEFAULT 1,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                deactivated_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ocr_imports (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                provider_id TEXT NOT NULL,
                source_type TEXT NOT NULL CHECK(source_type='OCR_IMPORT'),
                source_label TEXT NOT NULL,
                candidate_text TEXT NOT NULL DEFAULT '',
                confirmed_text TEXT,
                locale TEXT,
                script TEXT,
                confirmed_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                private_content INTEGER NOT NULL DEFAULT 1,
                provenance_status TEXT NOT NULL DEFAULT 'PRIVATE_OK',
                commercial_ready INTEGER NOT NULL DEFAULT 0,
                review_status TEXT NOT NULL DEFAULT 'CANDIDATE',
                school_queue_item_id TEXT,
                provenance_json TEXT
            );
            CREATE TABLE IF NOT EXISTS weekly_tests (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                item_ids TEXT NOT NULL,
                submitted_answers TEXT,
                correctness TEXT,
                score INTEGER,
                total INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS points_ledger (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                event_type TEXT NOT NULL,
                points_delta INTEGER NOT NULL,
                related_entity TEXT,
                event_key TEXT NOT NULL UNIQUE,
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reason TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reward_catalog (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                cost INTEGER NOT NULL CHECK(cost > 0),
                active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS reward_redemptions (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                reward_id TEXT NOT NULL REFERENCES reward_catalog(id),
                cost INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS words (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), word TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '',
                license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(child_id, word)
            );
            CREATE TABLE IF NOT EXISTS word_characters (
                word_id TEXT NOT NULL REFERENCES words(id), character TEXT NOT NULL, position INTEGER NOT NULL,
                PRIMARY KEY(word_id, position)
            );
            CREATE TABLE IF NOT EXISTS sentences (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), sentence TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sentence_words (
                sentence_id TEXT NOT NULL REFERENCES sentences(id), word_id TEXT NOT NULL REFERENCES words(id), position INTEGER NOT NULL,
                PRIMARY KEY(sentence_id, position)
            );
            CREATE TABLE IF NOT EXISTS word_states (
                child_id INTEGER NOT NULL REFERENCES children(id), word_id TEXT NOT NULL REFERENCES words(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0,
                assisted_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id, word_id)
            );
            CREATE TABLE IF NOT EXISTS word_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), word_id TEXT NOT NULL REFERENCES words(id),
                result TEXT NOT NULL, assisted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sentence_states (
                child_id INTEGER NOT NULL REFERENCES children(id), sentence_id TEXT NOT NULL REFERENCES sentences(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0,
                assisted_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id, sentence_id)
            );
            CREATE TABLE IF NOT EXISTS sentence_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), sentence_id TEXT NOT NULL REFERENCES sentences(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS writing_states (
                child_id INTEGER NOT NULL REFERENCES children(id), character TEXT NOT NULL,
                independent_success_count INTEGER NOT NULL DEFAULT 0, assisted_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(child_id, character)
            );
            CREATE TABLE IF NOT EXISTS writing_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), character TEXT NOT NULL,
                trace_result TEXT NOT NULL CHECK(trace_result IN ('correct','incorrect')), assisted INTEGER NOT NULL DEFAULT 0,
                provider TEXT NOT NULL DEFAULT 'MANUAL_TRACE_RULE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS pronunciation_readings (
                id TEXT PRIMARY KEY, character TEXT NOT NULL, script TEXT NOT NULL CHECK(script IN ('TRADITIONAL','SIMPLIFIED')),
                notation_system TEXT NOT NULL CHECK(notation_system IN ('ZHUYIN','PINYIN')),
                notation TEXT NOT NULL, locale TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', source_name TEXT NOT NULL, license_name TEXT NOT NULL,
                provenance_status TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS pronunciation_states (
                child_id INTEGER NOT NULL REFERENCES children(id), reading_id TEXT NOT NULL REFERENCES pronunciation_readings(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0,
                assisted_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id, reading_id)
            );
            CREATE TABLE IF NOT EXISTS pronunciation_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), reading_id TEXT NOT NULL REFERENCES pronunciation_readings(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0,
                source_type TEXT NOT NULL DEFAULT 'SPRINT_B', school_queue_item_id TEXT, prompt_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS school_pinyin_prompts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id),
                school_queue_item_id TEXT NOT NULL REFERENCES school_queue_items(id), reading_id TEXT NOT NULL REFERENCES pronunciation_readings(id),
                prompted_character TEXT NOT NULL, source_name TEXT NOT NULL, provenance_status TEXT NOT NULL,
                private_content INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(school_queue_item_id, reading_id)
            );
            CREATE TABLE IF NOT EXISTS grammar_concepts (
                id TEXT PRIMARY KEY, concept TEXT NOT NULL, explanation TEXT NOT NULL, example TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grammar_exercises (
                id TEXT PRIMARY KEY, concept_id TEXT NOT NULL REFERENCES grammar_concepts(id), prompt TEXT NOT NULL,
                answer_rule TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grammar_states (
                child_id INTEGER NOT NULL REFERENCES children(id), exercise_id TEXT NOT NULL REFERENCES grammar_exercises(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0, assisted_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id, exercise_id)
            );
            CREATE TABLE IF NOT EXISTS grammar_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), exercise_id TEXT NOT NULL REFERENCES grammar_exercises(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS idioms (
                id TEXT PRIMARY KEY, idiom TEXT NOT NULL, meaning TEXT NOT NULL, example TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS idiom_characters (
                idiom_id TEXT NOT NULL REFERENCES idioms(id), character TEXT NOT NULL, position INTEGER NOT NULL,
                PRIMARY KEY(idiom_id, position)
            );
            CREATE TABLE IF NOT EXISTS idiom_states (
                child_id INTEGER NOT NULL REFERENCES children(id), idiom_id TEXT NOT NULL REFERENCES idioms(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(child_id, idiom_id)
            );
            CREATE TABLE IF NOT EXISTS idiom_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), idiom_id TEXT NOT NULL REFERENCES idioms(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS reading_passages (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), title TEXT NOT NULL, passage TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS passage_vocabulary (
                passage_id TEXT NOT NULL REFERENCES reading_passages(id), word_id TEXT NOT NULL REFERENCES words(id), PRIMARY KEY(passage_id, word_id)
            );
            CREATE TABLE IF NOT EXISTS reading_questions (
                id TEXT PRIMARY KEY, passage_id TEXT NOT NULL REFERENCES reading_passages(id), prompt TEXT NOT NULL, answer_rule TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reading_states (
                child_id INTEGER NOT NULL REFERENCES children(id), passage_id TEXT NOT NULL REFERENCES reading_passages(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(child_id, passage_id)
            );
            CREATE TABLE IF NOT EXISTS reading_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), passage_id TEXT NOT NULL REFERENCES reading_passages(id),
                score INTEGER NOT NULL, total INTEGER NOT NULL, answers_json TEXT NOT NULL DEFAULT '{}',
                correctness_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS reading_aloud_attempts (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                source_type TEXT NOT NULL,
                source_id TEXT,
                text_snapshot TEXT NOT NULL,
                text_kind TEXT NOT NULL CHECK(text_kind IN ('character','word','sentence','passage')),
                locale TEXT NOT NULL CHECK(locale IN ('zh-TW','zh-CN')),
                started_at TEXT NOT NULL,
                completed_at TEXT,
                aborted_at TEXT,
                duration_ms INTEGER,
                status TEXT NOT NULL DEFAULT 'STARTED' CHECK(status IN ('STARTED','COMPLETED','ABORTED')),
                assisted INTEGER NOT NULL DEFAULT 0,
                manual_review INTEGER NOT NULL DEFAULT 0,
                provenance_json TEXT
            );
            CREATE TABLE IF NOT EXISTS srs_review_states (
                child_id INTEGER NOT NULL REFERENCES children(id),
                skill_domain TEXT NOT NULL,
                item_id TEXT NOT NULL,
                stage INTEGER NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 8),
                due_at TEXT NOT NULL,
                last_result TEXT NOT NULL CHECK(last_result IN ('correct','incorrect')),
                last_assisted INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(child_id,skill_domain,item_id)
            );
            CREATE TABLE IF NOT EXISTS srs_review_events (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                skill_domain TEXT NOT NULL,
                item_id TEXT NOT NULL,
                result TEXT NOT NULL CHECK(result IN ('correct','incorrect')),
                assisted INTEGER NOT NULL DEFAULT 0,
                previous_stage INTEGER NOT NULL,
                next_stage INTEGER NOT NULL,
                interval_minutes INTEGER NOT NULL,
                occurred_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS curriculum_item_links (
                child_id INTEGER NOT NULL REFERENCES children(id),
                skill_domain TEXT NOT NULL,
                item_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                PRIMARY KEY(child_id,skill_domain,item_id)
            );
            CREATE TABLE IF NOT EXISTS curriculum_lesson_states (
                child_id INTEGER NOT NULL REFERENCES children(id),
                lesson_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','IN_PROGRESS','PRACTICED','READY_FOR_CHECK','MASTERED','NEEDS_REVIEW')),
                soft_unlocked INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(child_id,lesson_id)
            );
            CREATE TABLE IF NOT EXISTS curriculum_lesson_events (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                lesson_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                status TEXT NOT NULL,
                details_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS curriculum_skill_evidence (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL REFERENCES children(id),
                lesson_id TEXT NOT NULL,
                skill_domain TEXT NOT NULL,
                script_mode TEXT CHECK(script_mode IN ('zhuyin','pinyin') OR script_mode IS NULL),
                score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
                assisted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        # Keep existing family databases forward-compatible with the Sprint B audit fields.
        migrations = {
            "pronunciation_readings": [
                ("script", "TEXT NOT NULL DEFAULT 'TRADITIONAL'"),
                ("context", "TEXT NOT NULL DEFAULT ''"),
                ("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
            ],
            "school_queue_items": [("completed_at", "TEXT"), ("deactivated_at", "TEXT")],
            "review_queue_items": [("deactivated_at", "TEXT")],
            "words": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "sentences": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "grammar_concepts": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "grammar_exercises": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "idioms": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "reading_passages": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "pronunciation_states": [("assisted_count", "INTEGER NOT NULL DEFAULT 0"), ("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "grammar_states": [("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "grammar_attempts": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "idiom_states": [("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "idiom_attempts": [("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "reading_states": [("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")],
            "pronunciation_attempts": [
                ("assisted", "INTEGER NOT NULL DEFAULT 0"),
                ("source_type", "TEXT NOT NULL DEFAULT 'SPRINT_B'"),
                ("school_queue_item_id", "TEXT"),
                ("prompt_id", "TEXT")
            ],
            "reading_attempts": [
                ("answers_json", "TEXT NOT NULL DEFAULT '{}'"),
                ("correctness_json", "TEXT NOT NULL DEFAULT '{}'")
            ],
            "reading_aloud_attempts": [
                ("status", "TEXT NOT NULL DEFAULT 'STARTED'"),
                ("aborted_at", "TEXT")
            ],
            "weekly_tests": [
                ("assessment_blueprint", "TEXT NOT NULL DEFAULT '{}'"),
                ("domain_scores", "TEXT NOT NULL DEFAULT '{}'"),
            ],
            "curriculum_skill_evidence": [
                ("script_mode", "TEXT"),
                ("evidence_ref", "TEXT"),
                ("evidence_type", "TEXT"),
                ("evidence_item_id", "TEXT"),
            ],
            "ocr_imports": [("confirmed_at", "TEXT")],
        }
        for table, columns in migrations.items():
            existing = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
            for column, definition in columns:
                if column not in existing:
                    connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        current_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        if current_version > SCHEMA_VERSION:
            raise RuntimeError("database_schema_newer_than_application")
        if current_version < SCHEMA_VERSION:
            connection.execute("INSERT OR IGNORE INTO schema_migrations(version, description) VALUES (?, ?)", (SCHEMA_VERSION, "baseline schema and additive audit migrations"))
            connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
