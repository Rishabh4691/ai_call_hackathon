"""Person A: Piper text-to-speech. See docs/Backend_Person_A_Voice_API.pdf section 6.

One German and one English voice, chosen by the language of the reply.
Contract: synthesize(text, language) -> path to a .wav file.
"""

import os
import re
import uuid
import wave
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = BACKEND_DIR / "tmp" / "audio"
MODELS_DIR = BACKEND_DIR / "models"

VOICE_FILES = {
    "de": os.getenv("PIPER_VOICE_DE", str(MODELS_DIR / "de_DE-thorsten-medium.onnx")),
    "en": os.getenv("PIPER_VOICE_EN", str(MODELS_DIR / "en_US-lessac-medium.onnx")),
}

# Speaking speed: length_scale > 1.0 is slower (1.0 = Piper default). 1.25 = about 25% slower.
LENGTH_SCALE = float(os.getenv("TTS_LENGTH_SCALE", "1.25"))
# Extra silence after each sentence, so listeners can follow.
SENTENCE_PAUSE_SECONDS = float(os.getenv("TTS_SENTENCE_PAUSE", "0.5"))

_voices: dict = {}
MIX_GERMAN_NAMES = os.getenv("TTS_GERMAN_NAMES", "1") == "1"   # set to 0 to disable


def load() -> None:
    """Load both voices once at startup."""
    from piper import PiperVoice

    for language, path in VOICE_FILES.items():
        if not os.path.exists(path):
            raise RuntimeError(f"Piper voice not found: {path}. See backend/README_voice.md, 'Download the voices'.")
        _voices[language] = PiperVoice.load(path)


def voice_names() -> dict:
    return {language: Path(path).stem for language, path in VOICE_FILES.items()}


# Abbreviations that sound wrong when read aloud. Extend after listening to the output.
_EXPANSIONS = {
    "de": [
        (r"\bMo\s*[-–]\s*Fr\b", "Montag bis Freitag"),
        (r"\bMo\s*[-–]\s*Do\b", "Montag bis Donnerstag"),
        (r"\bSa\b", "Samstag"),
        (r"\bStr\.", "Straße"),
        (r"\bz\.\s?B\.", "zum Beispiel"),
        (r"\bca\.", "circa"),
    ],
    "en": [
        (r"\bMon\s*[-–]\s*Fri\b", "Monday to Friday"),
        (r"\be\.g\.", "for example"),
    ],
}

_EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]")

_DIGIT_WORDS = {
    "de": ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"],
    "en": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
}
_PLUS = {"de": "plus", "en": "plus"}
_RANGE_WORD = {"de": "bis", "en": "to"}

# A phone number: optional +, then digits with spaces, hyphens, slashes or parentheses,
# at least 6 digits in total (so postcodes like 97070 and times like 9-12 are not matched).
_PHONE = re.compile(r"(?<![\w])(\+?\(?\d[\d\s\-/()]{4,}\d)(?![\w])")


def _speak_phone(match: re.Match, language: str) -> str:
    raw = match.group(1)
    if sum(ch.isdigit() for ch in raw) < 6:
        return raw
    words = _DIGIT_WORDS.get(language, _DIGIT_WORDS["de"])
    groups = [g for g in re.split(r"[\s\-/()]+", raw) if g]
    spoken = []
    for group in groups:
        parts = [_PLUS.get(language, "plus")] if group.startswith("+") else []
        parts += [words[int(d)] for d in group if d.isdigit()]
        spoken.append(" ".join(parts))
    # Commas make Piper pause briefly between the digit groups.
    return ", ".join(spoken) + ","


def clean_for_speech(text: str, language: str) -> str:
    """Strip markdown and emojis, read phone numbers digit by digit, expand ranges and abbreviations."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)      # [label](url) -> label
    text = re.sub(r"https?://\S+", "", text)                    # bare URLs are unreadable
    text = re.sub(r"[*_#`>|]+", "", text)                       # markdown symbols
    text = _EMOJI.sub("", text)
    text = _PHONE.sub(lambda m: _speak_phone(m, language), text)  # before ranges: phones contain hyphens
    words = _DIGIT_WORDS.get(language, _DIGIT_WORDS["de"])
    text = re.sub(r"\b(\d{5})\b", lambda m: " ".join(words[int(d)] for d in m.group(1)), text)  # postcodes
    for pattern, replacement in _EXPANSIONS.get(language, []):
        text = re.sub(pattern, replacement, text)
    if language == "de":
        text = re.sub(r"\b(\d{1,2}):00\b", r"\1 Uhr", text)             # 10:00 -> 10 Uhr
        text = re.sub(r"\b(\d{1,2}):(\d{2})\b", r"\1 Uhr \2", text)      # 12:30 -> 12 Uhr 30
        text = re.sub(r"\bUhr Uhr\b", "Uhr", text)                       # "10:00 Uhr" -> "10 Uhr"
    # Number ranges: 4–6 -> 4 bis 6, 9–12 -> 9 bis 12
    text = re.sub(r"\b(\d+)\s*[–-]\s*(\d+)\b", rf"\1 {_RANGE_WORD.get(language, 'bis')} \2", text)
    text = re.sub(r",\s*([.!?,;:])", r"\1", text)               # no doubled punctuation after a phone number
    return re.sub(r"\s+", " ", text).strip()


# ---------------- German names inside English replies ----------------
# English replies still contain German names (streets, towns, services). The English voice speaks them
# with German pronunciation symbols (phonemes), so the whole reply keeps ONE voice. Heuristic; extend the lists.
_GERMAN_TOWNS = {
    "würzburg", "wuerzburg", "kitzingen", "aschaffenburg", "haßfurt", "hassfurt", "kissingen", "schweinfurt",
    "lohr", "karlstadt", "miltenberg", "bürgstadt", "neustadt", "unterfranken", "main-spessart",
    "rhön-grabfeld", "haßberge", "hassberge", "saale", "ochsenfurt", "marktheidenfeld", "gemünden",
    "gerolzhofen", "volkach", "dettelbach", "hammelburg", "mellrichstadt", "obernburg", "alzenau",
}
_GERMAN_SUFFIXES = ("straße", "strasse", "str", "weg", "platz", "gasse", "allee", "beratung", "stelle",
                    "dienst", "seelsorge", "verband", "zentrum", "hilfe", "werk", "haus")
_GERMAN_CONNECTORS = {"und", "für", "fuer", "am", "an", "der", "die", "das", "im", "zur", "zum", "bei", "bad", "sankt"}
_TOKEN = re.compile(r"\d+[a-zA-Z]?(?:\s*[–-]\s*\d+[a-zA-Z]?)?|[A-Za-zÄÖÜäöüß][\wÄÖÜäöüß\-]*\.?")
_STREET = re.compile(r"(straße|strasse|str\.?|weg|platz|gasse|allee)$", re.IGNORECASE)


def _is_german_word(token: str) -> bool:
    word = token.rstrip(".")
    low = word.lower()
    if re.search(r"[äöüßÄÖÜ]", word) or low in _GERMAN_TOWNS:
        return True
    if word[:1].isupper() and word.endswith("-"):          # truncated compound: "Schuldner- und ..."
        return True
    return word[:1].isupper() and len(word) > 5 and low.endswith(_GERMAN_SUFFIXES)


def german_spans(text: str) -> list[tuple[int, int]]:
    """Character spans of German names inside an English sentence."""
    tokens = list(_TOKEN.finditer(text))
    words = [m.group(0) for m in tokens]
    german = [(_is_german_word(w) if not w[0].isdigit() else False) for w in words]

    def sentence_start(i: int) -> bool:
        before = text[: tokens[i].start()].rstrip()
        return not before or before[-1] in ".!?:"

    changed = True
    while changed:
        changed = False
        for i, w in enumerate(words):
            if german[i]:
                continue
            prev_g = i > 0 and german[i - 1]
            next_g = i + 1 < len(words) and german[i + 1]
            low = w.rstrip(".").lower()
            make = False
            if w[0].isdigit():
                make = False  # numbers stay in the reply language
            elif low in _GERMAN_CONNECTORS:
                # look past further connectors: "Neustadt an der Saale"
                j = i + 1
                while j < len(words) and words[j].lower() in _GERMAN_CONNECTORS and not german[j]:
                    j += 1
                ahead_g = j < len(words) and german[j]
                make = ahead_g and (prev_g or low in ("bad", "sankt"))
                if make:
                    for k in range(i + 1, j):
                        german[k] = True
            elif w[:1].isupper():
                # "Psychosoziale Beratungsstelle", "für Suchtprobleme"
                after_connector = i > 0 and german[i - 1] and words[i - 1].lower() in _GERMAN_CONNECTORS
                make = after_connector or (next_g and not sentence_start(i))
            if make:
                german[i] = True
                changed = True

    spans, start = [], None
    for i, m in enumerate(tokens):
        if german[i] and start is None:
            start = m.start()
        if german[i] and (i + 1 == len(tokens) or not german[i + 1]):
            spans.append((start, m.end() - (1 if m.group(0).endswith(".") and not _STREET.search(m.group(0)) else 0)))
            start = None
    return spans


_espeak = None


def _german_phonemes(span: str) -> str:
    """German pronunciation symbols for a name, to be spoken by the English voice."""
    global _espeak
    import piper.voice as piper_voice
    from piper.phonemize_espeak import ESPEAK_DATA_DIR, EspeakPhonemizer

    with piper_voice._ESPEAK_PHONEMIZER_LOCK:     # espeak-ng is not thread safe
        if _espeak is None:
            _espeak = EspeakPhonemizer(ESPEAK_DATA_DIR)
        sentences = _espeak.phonemize("de", span)
    return " ".join("".join(sentence) for sentence in sentences).strip()


def prepare_sentence(sentence: str, language: str) -> str:
    """In English, replace German names in one cleaned sentence with [[German phonemes]].

    Punctuation right after a name goes inside the block, so Piper keeps the pause it marks.
    """
    if language != "en" or not MIX_GERMAN_NAMES:
        return sentence
    out, pos = [], 0
    for start, end in german_spans(sentence):
        phonemes = _german_phonemes(sentence[start:end])
        if not phonemes:
            continue
        punct = ""
        while end < len(sentence) and sentence[end] in ".,!?;:":
            punct += sentence[end]
            end += 1
        out.append(sentence[pos:start])
        out.append(f"[[{phonemes}{punct}]]")
        pos = end
    out.append(sentence[pos:])
    return "".join(out)


def split_sentences(text: str) -> list[str]:
    return [part for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def synthesize(text: str, language: str) -> str:
    """Contract function: write the reply to tmp/audio/<uuid>.wav and return its path."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    out_path = AUDIO_DIR / f"{uuid.uuid4().hex}.wav"
    voice = _voices.get(language) or _voices["de"]
    with wave.open(str(out_path), "wb") as wav:
        if not hasattr(voice, "synthesize_wav"):   # older piper-tts versions
            voice.synthesize(clean_for_speech(text, language), wav, length_scale=LENGTH_SCALE)
            return str(out_path)

        from piper import SynthesisConfig

        config = SynthesisConfig(length_scale=LENGTH_SCALE)
        first = True
        for sentence in split_sentences(clean_for_speech(text, language)):
            for chunk in voice.synthesize(prepare_sentence(sentence, language), syn_config=config):
                if first:
                    wav.setframerate(chunk.sample_rate)
                    wav.setsampwidth(chunk.sample_width)
                    wav.setnchannels(chunk.sample_channels)
                    first = False
                wav.writeframes(chunk.audio_int16_bytes)
            if not first:  # pause after every sentence, so listeners can follow
                pause_frames = int(_rate * SENTENCE_PAUSE_SECONDS) if (_rate := wav.getframerate()) else 0
                wav.writeframes(b"\x00" * pause_frames * wav.getsampwidth() * wav.getnchannels())
        if first:  # empty text: write a valid, silent file
            wav.setframerate(22050)
            wav.setsampwidth(2)
            wav.setnchannels(1)
    return str(out_path)
