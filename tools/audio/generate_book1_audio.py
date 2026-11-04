"""Generate the book 1 voice clips with CosyVoice3 and check each one by speech recognition.

Voice: CosyVoice3 (Fun-CosyVoice3-0.5B, Apache-2.0) cloning one AISHELL-3 speaker
(SSB0009, Apache-2.0 corpus), chosen by the owner on 2026-11-04. See docs/audio-provenance.md.

Every clip is transcribed back with SenseVoiceSmall and compared with the expected
simplified text. A clip that does not match is regenerated with other seeds; clips that
never match are listed in the report for a person to listen to. SenseVoice is only used
for this internal check and is not shipped.

Run with the CosyVoice environment (it needs torch, CosyVoice and funasr):
    D:/CodexProjects/CosyVoice3/.venv/Scripts/python.exe tools/audio/generate_book1_audio.py
Requires ffmpeg on PATH for mp3 encoding.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
COSYVOICE = Path("D:/CodexProjects/CosyVoice3")
STAGES = REPO / "shared" / "curriculum" / "book1"
OUT = REPO / "frontend" / "public" / "audio" / "book1"
REFERENCE_WAV = COSYVOICE / "outputs" / "tongxuan_trial" / "ref_long" / "SSB00090025.wav"
REFERENCE_TEXT = "羊城晚报五月八日报道今年的母亲节五月十日"
VOICE_ID = "cosyvoice3-aishell3-SSB0009"
SPEED = 0.85
SEEDS = (1234, 2024, 7, 99, 31415)
MP3_BITRATE = "48k"
PUNCTUATION = re.compile(r"[\s。！？，、：；「」…!?,.:;]")
# Single characters that speech recognition cannot tell apart by sound alone.
HOMOPHONES = [set("他她它"), set("的得地"), set("是事式市")]

sys.path.insert(0, str(COSYVOICE))
sys.path.insert(0, str(COSYVOICE / "third_party" / "Matcha-TTS"))


def normalize(text: str) -> str:
    return PUNCTUATION.sub("", text)


@dataclass
class Clip:
    text: str            # what is spoken (traditional, with punctuation for prosody)
    expected_hans: str   # what recognition should hear
    keys: set[str] = field(default_factory=set)  # lookup keys: traditional and simplified, without punctuation


def collect_clips() -> list[Clip]:
    clips: dict[str, Clip] = {}

    def add(text: str, hans: str) -> None:
        key = normalize(text)
        clip = clips.setdefault(key, Clip(text=text, expected_hans=normalize(hans)))
        clip.keys.update({key, normalize(hans)})

    for path in sorted(STAGES.glob("stage-*.json")):
        stage = json.loads(path.read_text(encoding="utf-8"))
        for lesson in stage["lessons"]:
            for entry in lesson["characters"]:
                add(entry["char"], entry["charHans"])
            for word in lesson["words"]:
                add(word["word"], word["wordHans"])
            for line in [*lesson["dialogue"], *lesson["sentences"]]:
                add(line["text"], line["textHans"])
    return list(clips.values())


def heard_matches(heard: str, expected: str) -> bool:
    heard = normalize(heard)
    if heard == expected:
        return True
    if len(heard) == len(expected) == 1:
        return any(heard in group and expected in group for group in HOMOPHONES)
    return False


def clip_file(clip: Clip) -> str:
    return hashlib.sha1(clip.text.encode("utf-8")).hexdigest()[:12] + ".mp3"


def main() -> int:
    import torch
    import torchaudio
    from cosyvoice.cli.cosyvoice import AutoModel
    from cosyvoice.utils.common import set_all_random_seed
    from funasr import AutoModel as AsrModel

    tts = AutoModel(model_dir=str(COSYVOICE / "pretrained_models" / "Fun-CosyVoice3-0.5B"))
    asr = AsrModel(model=str(COSYVOICE / "pretrained_models" / "SenseVoiceSmall"), disable_update=True, device="cuda:0", log_level="ERROR")
    prompt_text = "You are a helpful assistant.<|endofprompt|>" + REFERENCE_TEXT
    OUT.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, str] = {}
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for clip in collect_clips():
            target = OUT / clip_file(clip)
            attempts = []
            chosen = None
            for seed in SEEDS:
                set_all_random_seed(seed)
                chunks = list(tts.inference_zero_shot(clip.text, prompt_text, str(REFERENCE_WAV), stream=False, speed=SPEED))
                wav = Path(tmp) / f"{seed}.wav"
                torchaudio.save(str(wav), torch.cat([chunk["tts_speech"] for chunk in chunks], dim=1), tts.sample_rate)
                heard = asr.generate(input=str(wav), language="zh", use_itn=False)[0]["text"].split("|>")[-1]
                attempts.append({"seed": seed, "heard": heard})
                if chosen is None:
                    chosen = wav  # keep the first attempt as the fallback
                if heard_matches(heard, clip.expected_hans):
                    chosen = wav
                    break
            matched = heard_matches(attempts[-1]["heard"], clip.expected_hans)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(chosen), "-ac", "1", "-b:a", MP3_BITRATE, str(target)], check=True)
            for key in clip.keys:
                manifest[key] = target.name
            report.append({"text": clip.text, "file": target.name, "verified": matched, "attempts": attempts})
            print(("OK  " if matched else "CHECK"), clip.text, "->", attempts[-1]["heard"], flush=True)

    (OUT / "manifest.json").write_text(json.dumps({"voice": VOICE_ID, "speed": SPEED, "clips": dict(sorted(manifest.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (REPO / "tools" / "audio" / "book1-audio-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    unverified = [item["text"] for item in report if not item["verified"]]
    print(f"{len(report)} clips, {len(report) - len(unverified)} verified, to check by ear: {unverified}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
