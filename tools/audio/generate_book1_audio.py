"""Generate the book 1 and feedback voice clips with CosyVoice3 and check each one by speech recognition.

Voice: CosyVoice3 (Fun-CosyVoice3-0.5B, Apache-2.0) cloning one AISHELL-3 speaker
(SSB0009, Apache-2.0 corpus), chosen by the owner on 2026-11-04. See docs/audio-provenance.md.

Every clip is transcribed back with SenseVoiceSmall and compared with the expected
simplified text. A clip that does not match is regenerated with other seeds; clips that
never match are listed in the report for a person to listen to. SenseVoice is only used
for this internal check and is not shipped.

Run with the CosyVoice environment (it needs torch, CosyVoice and funasr):
    D:/CodexProjects/CosyVoice3/.venv/Scripts/python.exe tools/audio/generate_book1_audio.py [book1] [feedback] [--regenerate]
With no names, every clip set is processed. Existing clips listed in the previous report are kept
unchanged (so voices already approved by ear do not shift); pass --regenerate to redo every clip.
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
AUDIO = REPO / "frontend" / "public" / "audio"
FEEDBACK_PHRASES = REPO / "shared" / "voice" / "feedback-phrases.json"
REFERENCE_WAV = COSYVOICE / "outputs" / "tongxuan_trial" / "ref_long" / "SSB00090025.wav"
REFERENCE_TEXT = "羊城晚报五月八日报道今年的母亲节五月十日"
VOICE_ID = "cosyvoice3-aishell3-SSB0009"
SPEED = 0.85
SEEDS = (1234, 2024, 7, 99, 31415)
MP3_BITRATE = "48k"
PUNCTUATION = re.compile(r"[\s。！？，、：；「」…!?,.:;]")
# Single characters that speech recognition cannot tell apart by sound alone.
HOMOPHONES = [set("他她它"), set("的得地"), set("是事式市"), set("弟第帝"), set("什神"), set("見件建"), set("再在")]

# Characters that cannot be spoken alone (neutral tone, no meaning by themselves) are voiced
# through the word they live in: tapping 麼 plays 什麼. Values: (spoken traditional, expected simplified).
SPOKEN_AS = {"麼": ("什麼", "什么")}

sys.path.insert(0, str(COSYVOICE))
sys.path.insert(0, str(COSYVOICE / "third_party" / "Matcha-TTS"))


def normalize(text: str) -> str:
    return PUNCTUATION.sub("", text)


@dataclass
class Clip:
    text: str            # the text this clip is looked up by (traditional, with punctuation)
    expected_hans: str   # what recognition should hear
    spoken: str = ""     # what is actually spoken, when it differs from text (see SPOKEN_AS)
    keys: set[str] = field(default_factory=set)  # lookup keys: traditional and simplified, without punctuation


class ClipSet:
    def __init__(self) -> None:
        self.clips: dict[str, Clip] = {}

    def add(self, text: str, hans: str) -> None:
        key = normalize(text)
        spoken, spoken_hans = SPOKEN_AS.get(text, (text, hans))
        clip = self.clips.setdefault(key, Clip(text=text, expected_hans=normalize(spoken_hans), spoken=spoken))
        clip.keys.update({key, normalize(hans)})


def collect_book1() -> list[Clip]:
    clips = ClipSet()
    add = clips.add
    for path in sorted(STAGES.glob("stage-*.json")):
        stage = json.loads(path.read_text(encoding="utf-8"))
        for lesson in stage["lessons"]:
            for entry in lesson["characters"]:
                add(entry["char"], entry["charHans"])
            for word in lesson["words"]:
                add(word["word"], word["wordHans"])
            for line in [*lesson["dialogue"], *lesson["sentences"]]:
                add(line["text"], line["textHans"])
    return list(clips.clips.values())


def collect_feedback() -> list[Clip]:
    clips = ClipSet()
    for phrase in json.loads(FEEDBACK_PHRASES.read_text(encoding="utf-8"))["phrases"].values():
        clips.add(phrase["text"], phrase["textHans"])
    return list(clips.clips.values())


# name -> (clips to speak, output folder); the frontend loads <folder>/manifest.json
CLIP_SETS = {"book1": collect_book1, "feedback": collect_feedback}


def heard_matches(heard: str, expected: str) -> bool:
    heard = normalize(heard)
    if heard == expected:
        return True
    if len(heard) != len(expected):
        return False
    # Same length: every differing character must be a homophone of the expected one.
    return all(
        a == b or any(a in group and b in group for group in HOMOPHONES)
        for a, b in zip(heard, expected)
    )


def clip_file(clip: Clip) -> str:
    return hashlib.sha1(clip.text.encode("utf-8")).hexdigest()[:12] + ".mp3"


def main(names: list[str], regenerate: bool = False) -> int:
    import torch
    import torchaudio
    from cosyvoice.cli.cosyvoice import AutoModel
    from cosyvoice.utils.common import set_all_random_seed
    from funasr import AutoModel as AsrModel

    tts = AutoModel(model_dir=str(COSYVOICE / "pretrained_models" / "Fun-CosyVoice3-0.5B"))
    asr = AsrModel(model=str(COSYVOICE / "pretrained_models" / "SenseVoiceSmall"), disable_update=True, device="cuda:0", log_level="ERROR")
    prompt_text = "You are a helpful assistant.<|endofprompt|>" + REFERENCE_TEXT

    def synthesize(clip: Clip, target: Path, tmp: str) -> dict | None:
        """Generates one clip; returns None when every seed failed, so the app falls back to browser speech."""
        attempts = []
        chosen = None
        matched = False
        for seed in SEEDS:
            set_all_random_seed(seed)
            wav = Path(tmp) / f"{seed}.wav"
            try:
                chunks = list(tts.inference_zero_shot(clip.spoken or clip.text, prompt_text, str(REFERENCE_WAV), stream=False, speed=SPEED))
                torchaudio.save(str(wav), torch.cat([chunk["tts_speech"] for chunk in chunks], dim=1), tts.sample_rate)
            except RuntimeError as error:  # e.g. an empty result for a lone neutral-tone syllable such as 麼
                attempts.append({"seed": seed, "error": str(error)[:120]})
                continue
            heard = asr.generate(input=str(wav), language="zh", use_itn=False)[0]["text"].split("|>")[-1]
            attempts.append({"seed": seed, "heard": heard})
            if chosen is None:
                chosen = wav  # keep the first attempt as the fallback
            if heard_matches(heard, clip.expected_hans):
                chosen, matched = wav, True
                break
        if chosen is None:
            target.unlink(missing_ok=True)
            print("FAIL ", clip.text, "-> no audio from any seed", flush=True)
            return None
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(chosen), "-ac", "1", "-b:a", MP3_BITRATE, str(target)], check=True)
        print(("OK  " if matched else "CHECK"), clip.text, "->", attempts[-1].get("heard"), flush=True)
        return {"text": clip.text, "file": target.name, "verified": matched, "attempts": attempts}

    for name in names:
        out = AUDIO / name
        out.mkdir(parents=True, exist_ok=True)
        manifest: dict[str, str] = {}
        report = []
        report_path = REPO / "tools" / "audio" / f"{name}-audio-report.json"
        previous = {item["text"]: item for item in json.loads(report_path.read_text(encoding="utf-8"))} if report_path.exists() else {}
        with tempfile.TemporaryDirectory() as tmp:
            for clip in CLIP_SETS[name]():
                target = out / clip_file(clip)
                if not regenerate and target.exists() and previous.get(clip.text, {}).get("file") and clip.text not in SPOKEN_AS:
                    result = previous[clip.text]  # keep clips that were already generated and listened to
                else:
                    result = synthesize(clip, target, tmp)
                if result is None:
                    report.append({"text": clip.text, "file": None, "verified": False, "attempts": []})
                    continue
                report.append(result)
                for key in clip.keys:
                    manifest[key] = target.name
        (out / "manifest.json").write_text(json.dumps({"voice": VOICE_ID, "speed": SPEED, "clips": dict(sorted(manifest.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        unverified = [item["text"] for item in report if not item["verified"]]
        # Clips with no audio stay out of the manifest; the app speaks them with the browser voice.
        print(f"{name}: {len(report)} clips, {len(report) - len(unverified)} verified, to check by ear: {unverified}")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    regenerate = "--regenerate" in args
    requested = [arg for arg in args if arg != "--regenerate"] or list(CLIP_SETS)
    unknown = [name for name in requested if name not in CLIP_SETS]
    if unknown:
        sys.exit(f"unknown clip set(s): {unknown}; choose from {list(CLIP_SETS)}")
    sys.exit(main(requested, regenerate))
