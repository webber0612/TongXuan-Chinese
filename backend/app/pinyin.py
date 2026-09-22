"""Small deterministic Hanyu Pinyin normalization layer for family practice."""

import unicodedata

_TONE_MARKS = {
    "\u0304": 1,  # macron
    "\u0301": 2,  # acute
    "\u030c": 3,  # caron
    "\u0300": 4,  # grave
}
_VOWELS = {
    ("a", 1): "ā", ("a", 2): "á", ("a", 3): "ǎ", ("a", 4): "à",
    ("e", 1): "ē", ("e", 2): "é", ("e", 3): "ě", ("e", 4): "è",
    ("i", 1): "ī", ("i", 2): "í", ("i", 3): "ǐ", ("i", 4): "ì",
    ("o", 1): "ō", ("o", 2): "ó", ("o", 3): "ǒ", ("o", 4): "ò",
    ("u", 1): "ū", ("u", 2): "ú", ("u", 3): "ǔ", ("u", 4): "ù",
    ("ü", 1): "ǖ", ("ü", 2): "ǘ", ("ü", 3): "ǚ", ("ü", 4): "ǜ",
}


def _decompose(text: str) -> tuple[str, int | None]:
    base: list[str] = []
    tone: int | None = None
    for char in unicodedata.normalize("NFD", text.lower()):
        if unicodedata.combining(char):
            tone = _TONE_MARKS.get(char, tone)
        elif char == "ü" or char == "u":
            base.append(char)
        elif char == "v":
            base.append("ü")
        else:
            base.append(char)
    return "".join(base), tone


def normalize_pinyin(value: str) -> str:
    """Normalize canonical tone marks and optional tone-number input to one form."""
    compact = "".join(value.strip().lower().split())
    if not compact:
        return ""
    number_tone: int | None = None
    if compact[-1:] in {"1", "2", "3", "4", "5"}:
        number_tone = int(compact[-1])
        compact = compact[:-1]
    base, marked_tone = _decompose(compact)
    tone = marked_tone or number_tone
    if tone in (None, 5):
        return base
    vowel_index: int | None = None
    if "a" in base:
        vowel_index = base.index("a")
    elif "e" in base:
        vowel_index = base.index("e")
    elif "ou" in base:
        vowel_index = base.index("o")
    else:
        vowel_indices = [index for index, char in enumerate(base) if char in "iouü"]
        if vowel_indices:
            vowel_index = vowel_indices[-1]
    if vowel_index is None:
        return base
    vowel = base[vowel_index]
    return base[:vowel_index] + _VOWELS[(vowel, tone)] + base[vowel_index + 1:]
