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
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
                id TEXT PRIMARY KEY, character TEXT NOT NULL, notation_system TEXT NOT NULL CHECK(notation_system IN ('ZHUYIN','PINYIN')),
                notation TEXT NOT NULL, locale TEXT NOT NULL, source_name TEXT NOT NULL, license_name TEXT NOT NULL,
                provenance_status TEXT NOT NULL, commercial_ready INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS pronunciation_states (
                child_id INTEGER NOT NULL REFERENCES children(id), reading_id TEXT NOT NULL REFERENCES pronunciation_readings(id),
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(child_id, reading_id)
            );
            CREATE TABLE IF NOT EXISTS pronunciation_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), reading_id TEXT NOT NULL REFERENCES pronunciation_readings(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
                PRIMARY KEY(child_id, exercise_id)
            );
            CREATE TABLE IF NOT EXISTS grammar_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), exercise_id TEXT NOT NULL REFERENCES grammar_exercises(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0
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
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(child_id, idiom_id)
            );
            CREATE TABLE IF NOT EXISTS idiom_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), idiom_id TEXT NOT NULL REFERENCES idioms(id),
                answer TEXT NOT NULL, correct INTEGER NOT NULL, assisted INTEGER NOT NULL DEFAULT 0
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
                correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(child_id, passage_id)
            );
            CREATE TABLE IF NOT EXISTS reading_attempts (
                id TEXT PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id), passage_id TEXT NOT NULL REFERENCES reading_passages(id),
                score INTEGER NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
