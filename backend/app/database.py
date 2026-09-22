from __future__ import annotations

import os
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "tongxuan.sqlite3"


def database_path() -> Path:
    path = Path(os.getenv("TONGXUAN_DB_PATH", str(DEFAULT_DB_PATH)))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
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
                license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0,
                UNIQUE(child_id, word)
            );
            CREATE TABLE IF NOT EXISTS word_characters (
                word_id TEXT NOT NULL REFERENCES words(id), character TEXT NOT NULL, position INTEGER NOT NULL,
                PRIMARY KEY(word_id, position)
            );
            CREATE TABLE IF NOT EXISTS sentences (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), sentence TEXT NOT NULL,
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL,
                commercial_ready INTEGER NOT NULL DEFAULT 0
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
                provenance_status TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0
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
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS grammar_exercises (
                id TEXT PRIMARY KEY, concept_id TEXT NOT NULL REFERENCES grammar_concepts(id), prompt TEXT NOT NULL,
                answer_rule TEXT NOT NULL
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
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0
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
                provenance_status TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0
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
                duration_ms INTEGER,
                status TEXT NOT NULL DEFAULT 'STARTED' CHECK(status IN ('STARTED','COMPLETED','ABORTED')),
                assisted INTEGER NOT NULL DEFAULT 0,
                manual_review INTEGER NOT NULL DEFAULT 0,
                provenance_json TEXT
            );
            """
        )
        # Keep existing family databases forward-compatible with the Sprint B audit fields.
        migrations = {
            "pronunciation_readings": [
                ("script", "TEXT NOT NULL DEFAULT 'TRADITIONAL'"),
                ("context", "TEXT NOT NULL DEFAULT ''")
            ],
            "school_queue_items": [("completed_at", "TEXT"), ("deactivated_at", "TEXT")],
            "review_queue_items": [("deactivated_at", "TEXT")],
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
                ("status", "TEXT NOT NULL DEFAULT 'STARTED'")
            ],
        }
        for table, columns in migrations.items():
            existing = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
            for column, definition in columns:
                if column not in existing:
                    connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
