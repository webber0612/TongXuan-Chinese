"""Validate book 1 lesson content against the character order and the bounded-text rule.

Rules checked for every stage file in shared/curriculum/book1/:
- a lesson teaches exactly the characters the book 1 order assigns to it;
- each lesson marks 2 or 3 characters for writing;
- every character in words, sentences, dialogue and quiz items was taught in
  this lesson or an earlier one (simplified text is checked against the
  simplified forms of taught characters);
- quiz answers appear among their options and options are not repeated.

Usage:
    python scripts/curriculum_check.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ROOT / "shared" / "curriculum" / "book1-character-order.json"
STAGES = ROOT / "shared" / "curriculum" / "book1"
CJK = re.compile(r"[㐀-䶿一-鿿]")
WRITE_RANGE = range(2, 4)


def lesson_order() -> dict[int, list[str]]:
    order = json.loads(ORDER.read_text(encoding="utf-8"))
    return {lesson["lesson"]: lesson["characters"] for stage in order["stages"] for lesson in stage["lessons"]}


def taught_through(order: dict[int, list[str]], last_lesson: int, simplified: dict[str, str]) -> tuple[set[str], set[str]]:
    traditional = {char for number, chars in order.items() if number <= last_lesson for char in chars}
    return traditional, {simplified.get(char, char) for char in traditional}


def strings_in(item: object) -> list[str]:
    if isinstance(item, str):
        return [item]
    if isinstance(item, list):
        return [text for value in item for text in strings_in(value)]
    if isinstance(item, dict):
        return [text for key, value in item.items() if key not in {"en", "meaningEn", "goalEn"} for text in strings_in(value)]
    return []


def check_text(where: str, texts: list[str], allowed: set[str]) -> list[str]:
    stray = sorted({char for text in texts for char in CJK.findall(text) if char not in allowed})
    return [f"{where}: uses characters not taught yet: {''.join(stray)}"] if stray else []


def check_quiz(where: str, quiz: list[dict], allowed: set[str]) -> list[str]:
    errors = []
    for index, item in enumerate(quiz, 1):
        options = item.get("options", [])
        if item.get("answer") not in options:
            errors.append(f"{where} quiz {index}: answer is not among the options")
        if len(set(options)) != len(options):
            errors.append(f"{where} quiz {index}: repeated options")
        errors += check_text(f"{where} quiz {index}", strings_in({key: value for key, value in item.items() if key != "type"}), allowed)
    return errors


def check_stage(path: Path, order: dict[int, list[str]]) -> list[str]:
    stage = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    simplified: dict[str, str] = {}
    for lesson in stage["lessons"]:
        for entry in lesson["characters"]:
            simplified[entry["char"]] = entry["charHans"]
    for lesson in stage["lessons"]:
        number = lesson["lesson"]
        where = f"{path.name} lesson {number}"
        chars = [entry["char"] for entry in lesson["characters"]]
        if chars != order.get(number):
            errors.append(f"{where}: characters {''.join(chars)} differ from the book 1 order {''.join(order.get(number, []))}")
        writes = sum(1 for entry in lesson["characters"] if entry["write"])
        if writes not in WRITE_RANGE:
            errors.append(f"{where}: {writes} characters marked for writing, expected 2 or 3")
        for entry in lesson["characters"]:
            if not entry.get("zhuyin") or not entry.get("pinyin") or not isinstance(entry.get("strokes"), int) or entry["strokes"] < 1:
                errors.append(f"{where}: {entry['char']} is missing zhuyin, pinyin or a stroke count")
        traditional, hans = taught_through(order, number, simplified)
        allowed = traditional | hans
        for field in ("words", "sentences", "dialogue"):
            errors += check_text(f"{where} {field}", strings_in(lesson.get(field, [])), allowed)
        errors += check_quiz(where, lesson.get("quiz", []), allowed)
    checkpoint = stage.get("checkpoint")
    if checkpoint:
        traditional, hans = taught_through(order, max(checkpoint["scope"]), simplified)
        errors += check_quiz(f"{path.name} checkpoint", checkpoint["quiz"], traditional | hans)
    return errors


def main() -> int:
    order = lesson_order()
    stage_files = sorted(STAGES.glob("stage-*.json"))
    errors = [error for path in stage_files for error in check_stage(path, order)]
    for error in errors:
        print(f"CURRICULUM_INVALID: {error}")
    if not errors:
        lessons = sum(len(json.loads(path.read_text(encoding="utf-8"))["lessons"]) for path in stage_files)
        print(f"Curriculum check PASS: {len(stage_files)} stage file(s), {lessons} lesson(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
