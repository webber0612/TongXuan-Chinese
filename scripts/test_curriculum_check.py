import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import curriculum_check  # noqa: E402

STAGE_1 = curriculum_check.STAGES / "stage-01.json"


def run_on(tmp_path: Path, mutate) -> list[str]:
    stage = json.loads(STAGE_1.read_text(encoding="utf-8"))
    mutated = copy.deepcopy(stage)
    mutate(mutated)
    path = tmp_path / "stage-01.json"
    path.write_text(json.dumps(mutated, ensure_ascii=False), encoding="utf-8")
    return curriculum_check.check_stage(path, curriculum_check.lesson_order())


def test_stage_1_passes(tmp_path):
    assert run_on(tmp_path, lambda stage: None) == []


def test_sentence_with_an_untaught_character_fails(tmp_path):
    def add_untaught(stage):
        stage["lessons"][0]["sentences"].append({"text": "我們好。", "textHans": "我们好。", "en": ""})
    errors = run_on(tmp_path, add_untaught)
    assert any("們" in error and "lesson 1 sentences" in error for error in errors)


def test_later_lesson_may_reuse_earlier_characters(tmp_path):
    def reuse(stage):
        stage["lessons"][3]["sentences"].append({"text": "你好，我七歲。", "textHans": "你好，我七岁。", "en": ""})
    assert run_on(tmp_path, reuse) == []


def test_writing_count_outside_two_to_three_fails(tmp_path):
    def mark_all(stage):
        for entry in stage["lessons"][0]["characters"]:
            entry["write"] = True
    errors = run_on(tmp_path, mark_all)
    assert any("6 characters marked for writing" in error for error in errors)


def test_characters_must_match_the_order(tmp_path):
    def swap(stage):
        stage["lessons"][0]["characters"][0]["char"] = "們"
    errors = run_on(tmp_path, swap)
    assert any("differ from the book 1 order" in error for error in errors)


def test_quiz_answer_must_be_an_option(tmp_path):
    def break_quiz(stage):
        stage["lessons"][1]["quiz"][0]["answer"] = "四"
        stage["lessons"][1]["quiz"][0]["options"] = ["三", "二", "五", "一"]
    errors = run_on(tmp_path, break_quiz)
    assert any("answer is not among the options" in error for error in errors)
