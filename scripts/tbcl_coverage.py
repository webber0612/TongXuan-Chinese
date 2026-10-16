"""Report how TongXuan's lesson characters cover the TBCL character levels.

TBCL (臺灣華語文能力基準) is the curriculum's coverage target: stage 1 must teach
every level-1 character. The official list is read from the National Academy for
Educational Research search system at run time and cached locally (gitignored);
it is not redistributed in this repository.

Usage:
    python scripts/tbcl_coverage.py            # summary and per-level table
    python scripts/tbcl_coverage.py --missing  # also print untaught level-1 characters
"""

from __future__ import annotations

import argparse
import glob
import html
import json
import re
import ssl
import sys
import time
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / ".tbcl-cache" / "levels.json"
SOURCE_URL = "https://coct.naer.edu.tw/hanzi.jsp?page={page}"
LEVEL_DATA = ROOT / "frontend" / "src" / "data" / "learningPathData.ts"
LESSON_PACKAGES = ROOT / "shared" / "lesson-packages"
PAGES_THROUGH_LEVEL_3 = 45  # 20 rows per page, levels sorted ascending; level 3 ends before row 801.
EXPECTED_COUNTS = {1: 246, 2: 258, 3: 297}


@dataclass(frozen=True)
class TbclEntry:
    rank: int
    level: int
    harder: bool
    char: str


def _fetch_page(page: int) -> str:
    # The official site's certificate chain is not always trusted by Python; the data is public.
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(SOURCE_URL.format(page=page), timeout=30, context=context) as response:
        return response.read().decode("utf-8", errors="replace")


def _parse_rows(page_html: str) -> list[TbclEntry]:
    entries = []
    for row in re.findall(r"<tr.*?</tr>", page_html, flags=re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", cell)).strip() for cell in re.findall(r"<t[dh].*?</t[dh]>", row, flags=re.S)]
        if len(cells) < 3 or not cells[0].isdigit():
            continue
        match = re.search(r"第(\d)(\*?)級", cells[1])
        if match:
            entries.append(TbclEntry(int(cells[0]), int(match.group(1)), match.group(2) == "*", cells[2]))
    return entries


def load_tbcl(refresh: bool = False) -> list[TbclEntry]:
    if CACHE.exists() and not refresh:
        return [TbclEntry(**item) for item in json.loads(CACHE.read_text(encoding="utf-8"))]
    entries: dict[int, TbclEntry] = {}
    for page in range(1, PAGES_THROUGH_LEVEL_3 + 1):
        for entry in _parse_rows(_fetch_page(page)):
            entries[entry.rank] = entry
        time.sleep(0.3)
    ordered = [entries[rank] for rank in sorted(entries)]
    counts = Counter(entry.level for entry in ordered)
    for level, expected in EXPECTED_COUNTS.items():
        if counts[level] != expected:
            raise RuntimeError(f"TBCL level {level} has {counts[level]} characters, expected {expected}; the source page may have changed")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps([entry.__dict__ for entry in ordered], ensure_ascii=False), encoding="utf-8")
    return ordered


def lesson_levels() -> list[dict[str, object]]:
    source = LEVEL_DATA.read_text(encoding="utf-8")
    source = source[source.index("LEGACY_TONGXUAN_LEVEL_DATA"):source.index("function stampLegacyLevel")]
    parts = re.split(r"\n\s*levelNumber:\s*(\d+),", source)
    levels = []
    for index in range(1, len(parts), 2):
        body = parts[index + 1]
        levels.append({
            "number": int(parts[index]),
            "type": re.search(r'type:\s*"([a-z_]+)"', body).group(1),
            "title": re.search(r'themeTitle:\s*"([^"]+)"', body).group(1),
            "chars": re.findall(r'\bchar:\s*"(.)"', body),
        })
    return levels


def package_chars() -> set[str]:
    chars: set[str] = set()
    for path in glob.glob(str(LESSON_PACKAGES / "*.json")):
        for item in json.loads(Path(path).read_text(encoding="utf-8")).get("characters", []):
            for key in ("character", "char", "traditional", "text", "form"):
                value = item.get(key) if isinstance(item, dict) else None
                if isinstance(value, str) and len(value) == 1:
                    chars.add(value)
    return chars


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--missing", action="store_true", help="print the level-1 characters no lesson teaches yet")
    parser.add_argument("--refresh", action="store_true", help="re-download the official list instead of using the cache")
    args = parser.parse_args(argv)

    tbcl = load_tbcl(refresh=args.refresh)
    level_of = {entry.char: entry.level for entry in tbcl}
    band = lambda char: f"L{level_of[char]}" if char in level_of else "L4+"

    levels = lesson_levels()
    taught = list(dict.fromkeys(char for level in levels for char in level["chars"]))
    dialogue = package_chars()
    level_1 = [entry.char for entry in tbcl if entry.level == 1]
    covered = [char for char in level_1 if char in taught or char in dialogue]

    print("Lesson levels")
    for level in levels:
        off_target = " ".join(f"{char}:{band(char)}" for char in level["chars"] if band(char) != "L1")
        print(f"  {level['number']:>2} {level['type']:<14} {level['title']}  {''.join(level['chars'])}  {off_target}")
    print(f"\nCharacters taught in levels: {len(taught)} ({dict(Counter(band(char) for char in taught))})")
    print(f"Characters taught in conversation lessons: {len(dialogue)}")
    print(f"TBCL level 1 covered: {len(covered)} / {len(level_1)} ({len(covered) / len(level_1):.0%})")
    if args.missing:
        missing = [char for char in level_1 if char not in covered]
        print(f"\nLevel-1 characters not taught yet, most frequent first ({len(missing)}):\n{''.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
