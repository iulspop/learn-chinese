"""
Generate missing card data for HSK words that don't have Anki deck entries.

Generates:
- Example sentence + pinyin (with sandhi) + English meaning via Claude API
- Word audio + sentence audio via Google Cloud TTS WaveNet
- Sentence illustration via Stability AI (Stable Diffusion)

Usage:
    uv run generate.py                  # Generate all missing words
    uv run generate.py --limit 10       # Generate only 10 words
    uv run generate.py --dry-run        # Show what would be generated
    uv run generate.py --word 爱国      # Generate a single word

Requires env vars:
    ANTHROPIC_API_KEY
    GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
    STABILITY_API_KEY
"""

import argparse
import json
import os
import sys
import time
import hashlib
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(Path(__file__).resolve().parent / ".env")

import anthropic
import httpx
from google.cloud import texttospeech
from pypinyin import lazy_pinyin, Style
DATA_DIR = ROOT / "data"
COMPLETE_PATH = DATA_DIR / "complete.json"
INDEX_PATH = DATA_DIR / "word-index.json"
MEDIA_DIR = DATA_DIR / "media"

CLAUDE_MODEL = "claude-sonnet-4-20250514"
BATCH_SIZE = 20  # words per Claude API call
TTS_VOICE = "cmn-CN-Wavenet-C"  # female WaveNet voice
TTS_SPEAKING_RATE_WORD = 0.85
TTS_SPEAKING_RATE_SENTENCE = 0.80
SD_ENGINE = "sd3.5-medium"

# Map abbreviated POS codes from complete.json to readable labels
POS_MAP = {
    "a": "adjective", "ad": "adverb", "ag": "adjective morpheme",
    "an": "adjective-noun", "b": "distinguishing word", "c": "conjunction",
    "d": "adverb", "dg": "adverb morpheme", "e": "exclamation",
    "f": "directional word", "g": "morpheme", "h": "prefix",
    "i": "idiom", "j": "abbreviation", "k": "suffix",
    "l": "fixed expression", "m": "numeral", "n": "noun",
    "ng": "noun morpheme", "nr": "person name", "ns": "place name",
    "nt": "organization name", "nz": "other proper noun",
    "o": "onomatopoeia", "p": "preposition", "q": "measure word",
    "r": "pronoun", "s": "space/locality word", "t": "time word",
    "tg": "time morpheme", "u": "auxiliary", "v": "verb",
    "vd": "verb-adverb", "vg": "verb morpheme", "vn": "verb-noun",
    "w": "punctuation", "x": "non-morpheme character",
    "y": "modal particle", "z": "descriptive",
}


def load_hsk_words() -> list[dict]:
    """Load HSK words from complete.json, return those with new-* levels."""
    with open(COMPLETE_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    words = []
    for entry in raw:
        new_level = None
        for lv in entry.get("level", []):
            if lv.startswith("new-"):
                try:
                    new_level = int(lv[4:])
                except ValueError:
                    continue
                break
        if new_level is None:
            continue

        form = entry["forms"][0] if entry.get("forms") else None
        if not form:
            continue

        pos_codes = entry.get("pos", [])
        pos_label = ", ".join(POS_MAP.get(p, p) for p in pos_codes) if pos_codes else ""

        words.append({
            "simplified": entry["simplified"],
            "pinyin": form["transcriptions"]["pinyin"],
            "meaning": "; ".join(form["meanings"]),
            "hsk_level": new_level,
            "partOfSpeech": pos_label,
        })
    return words


def load_word_index() -> dict:
    if INDEX_PATH.exists():
        with open(INDEX_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_word_index(index: dict):
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_missing(hsk_words: list[dict], index: dict) -> list[dict]:
    """Find HSK words not in the word index."""
    indexed = set(index.keys())
    return [w for w in hsk_words if w["simplified"] not in indexed]


def get_sandhi_pinyin(text: str) -> str:
    """Get pinyin with tone sandhi applied using pypinyin."""
    syllables = lazy_pinyin(text, style=Style.TONE, tone_sandhi=True)
    return " ".join(syllables)


def get_dictionary_pinyin(text: str) -> str:
    """Get pinyin with dictionary tones (no sandhi)."""
    syllables = lazy_pinyin(text, style=Style.TONE)
    return " ".join(syllables)


def generate_sentences_batch(client: anthropic.Anthropic, words: list[dict]) -> list[dict]:
    """Generate example sentences for a batch of words using Claude."""
    word_list = "\n".join(
        f"- {w['simplified']} ({w['pinyin']}): {w['meaning']}"
        for w in words
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""Generate one natural example sentence for each Chinese word below.
Each sentence should be simple, practical, and appropriate for the word's HSK level.
Use the word naturally in context. Aim for 6-15 characters per sentence.

For each word, provide:
1. sentence: The example sentence in simplified Chinese
2. sentenceMeaning: English translation of the sentence
3. imagePrompt: A short visual description for illustration (10-20 words, no text/words in image). Focus on the WORD's core meaning rather than the sentence — e.g. for "tree" just show a tree, for "Arabic" show Arabic calligraphy or symbols, for "happy" show a smiling face. Keep it iconic and simple.

Return ONLY a JSON array with objects having keys: simplified, sentence, sentenceMeaning, imagePrompt

Words:
{word_list}"""
        }],
    )

    text = response.content[0].text
    # Extract JSON from response (may be wrapped in ```json ... ```)
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]

    return json.loads(text.strip())


def generate_audio(tts_client: texttospeech.TextToSpeechClient, text: str, speaking_rate: float) -> bytes:
    """Generate audio using Google Cloud TTS WaveNet."""
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="cmn-CN",
        name=TTS_VOICE,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
    )
    response = tts_client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content


def generate_image(api_key: str, prompt: str) -> bytes | None:
    """Generate an image using Stability AI API."""
    url = f"https://api.stability.ai/v2beta/stable-image/generate/sd3"

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "image/*",
            },
            files={"none": ""},
            data={
                "prompt": f"Simple flat illustration, clean modern style, no text or words: {prompt}",
                "model": SD_ENGINE,
                "output_format": "jpeg",
                "aspect_ratio": "5:4",
            },
        )
        if response.status_code == 200:
            return response.content
        else:
            print(f"  Image generation failed ({response.status_code}): {response.text}", file=sys.stderr)
            return None


def media_filename(word: str, suffix: str, ext: str) -> str:
    """Generate a deterministic filename for a media file."""
    h = hashlib.sha256(f"{word}:{suffix}".encode()).hexdigest()[:12]
    return f"gen_{h}.{ext}"


def generate_image_prompts(client: anthropic.Anthropic, entries: list[dict]) -> list[dict]:
    """Generate image prompts for existing entries that are missing images."""
    word_list = "\n".join(
        f"- {e['simplified']}: {e['sentence']} ({e['sentenceMeaning']})"
        for e in entries
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""For each Chinese word below, generate a short visual description for illustration (10-20 words, no text/words in image).
Focus on the WORD's core meaning rather than the sentence — e.g. for "tree" just show a tree, for "Arabic" show Arabic calligraphy or symbols, for "happy" show a smiling face. Keep it iconic and simple.

Return ONLY a JSON array with objects having keys: simplified, imagePrompt

Words:
{word_list}"""
        }],
    )

    text = response.content[0].text
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]

    return json.loads(text.strip())


def process_missing_images(
    entries: list[dict],
    index: dict,
    claude_client: anthropic.Anthropic,
    stability_key: str,
):
    """Generate images for index entries that have no sentenceImage."""
    print(f"\nGenerating image prompts for {len(entries)} words...")
    prompts = generate_image_prompts(claude_client, entries)
    prompt_map = {p["simplified"]: p["imagePrompt"] for p in prompts}

    for entry in entries:
        char = entry["simplified"]
        image_prompt = prompt_map.get(char)
        if not image_prompt:
            print(f"  WARNING: No image prompt generated for {char}, skipping")
            continue

        print(f"  {char}: generating image...")
        image_bytes = generate_image(stability_key, image_prompt)
        if image_bytes:
            image_file = media_filename(char, "image", "jpg")
            MEDIA_DIR.mkdir(parents=True, exist_ok=True)
            (MEDIA_DIR / image_file).write_bytes(image_bytes)
            index[char]["sentenceImage"] = image_file
            save_word_index(index)
            print(f"  {char}: done ✓")
        else:
            print(f"  {char}: image generation failed")

        time.sleep(0.5)


def process_batch(
    words: list[dict],
    index: dict,
    claude_client: anthropic.Anthropic,
    tts_client: texttospeech.TextToSpeechClient,
    stability_key: str,
    skip_images: bool = False,
):
    """Process a batch of words: generate sentences, audio, and images."""
    print(f"\nGenerating sentences for {len(words)} words...")
    sentences = generate_sentences_batch(claude_client, words)

    # Map by simplified character
    sentence_map = {s["simplified"]: s for s in sentences}

    for word in words:
        char = word["simplified"]
        sent_data = sentence_map.get(char)
        if not sent_data:
            print(f"  WARNING: No sentence generated for {char}, skipping")
            continue

        sentence = sent_data["sentence"]
        sentence_meaning = sent_data["sentenceMeaning"]
        image_prompt = sent_data["imagePrompt"]

        # Generate pinyin with sandhi
        sentence_pinyin_dict = get_dictionary_pinyin(sentence)
        sentence_pinyin_sandhi = get_sandhi_pinyin(sentence)

        # Capitalize first letter of sentence pinyin
        sentence_pinyin_dict = sentence_pinyin_dict[0].upper() + sentence_pinyin_dict[1:] if sentence_pinyin_dict else sentence_pinyin_dict
        sentence_pinyin_sandhi = sentence_pinyin_sandhi[0].upper() + sentence_pinyin_sandhi[1:] if sentence_pinyin_sandhi else sentence_pinyin_sandhi

        # Build sentencePinyin field (with sandhi annotation if different)
        if sentence_pinyin_dict != sentence_pinyin_sandhi:
            sentence_pinyin = f"{sentence_pinyin_dict} Sandhi: {sentence_pinyin_sandhi}"
        else:
            sentence_pinyin = sentence_pinyin_dict

        # Generate audio files
        print(f"  {char}: generating audio...")
        word_audio_bytes = generate_audio(tts_client, char, TTS_SPEAKING_RATE_WORD)
        sentence_audio_bytes = generate_audio(tts_client, sentence, TTS_SPEAKING_RATE_SENTENCE)

        word_audio_file = media_filename(char, "word", "mp3")
        sentence_audio_file = media_filename(char, "sentence", "mp3")

        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        (MEDIA_DIR / word_audio_file).write_bytes(word_audio_bytes)
        (MEDIA_DIR / sentence_audio_file).write_bytes(sentence_audio_bytes)

        # Generate image
        image_file = ""
        if not skip_images:
            print(f"  {char}: generating image...")
            image_bytes = generate_image(stability_key, image_prompt)
            if image_bytes:
                image_file = media_filename(char, "image", "jpg")
                (MEDIA_DIR / image_file).write_bytes(image_bytes)

        # Use the word's pinyin from complete.json (more reliable than pypinyin for single words)
        entry_pinyin = word["pinyin"]
        part_of_speech = word.get("partOfSpeech", "")

        # Update index
        index[char] = {
            "simplified": char,
            "pinyin": entry_pinyin,
            "meaning": word["meaning"],
            "partOfSpeech": part_of_speech,
            "audio": word_audio_file,
            "sentence": sentence,
            "sentencePinyin": sentence_pinyin,
            "sentenceMeaning": sentence_meaning,
            "sentenceAudio": sentence_audio_file,
            "sentenceImage": image_file,
            "source": "generated",
        }

        # Save after each word so progress isn't lost on failure
        save_word_index(index)
        print(f"  {char}: done ✓")

        # Small delay to avoid rate limits
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="Generate missing card data for HSK words")
    parser.add_argument("--limit", type=int, help="Max words to generate")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be generated (sentences only, no audio/images)")
    parser.add_argument("--word", type=str, help="Generate for a single word")
    parser.add_argument("--regenerate", action="store_true", help="Force regenerate even if word already exists in index (use with --word)")
    parser.add_argument("--skip-images", action="store_true", help="Skip image generation")
    parser.add_argument("--generate-missing-images", action="store_true", help="Generate images for entries that have no sentenceImage")
    parser.add_argument("--fix-capitalization", action="store_true", help="Capitalize first letter of all sentencePinyin entries")
    args = parser.parse_args()

    # Check env vars
    if not args.dry_run:
        for var in ["ANTHROPIC_API_KEY"]:
            if not os.environ.get(var):
                print(f"Error: {var} not set", file=sys.stderr)
                sys.exit(1)
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            print("Error: GOOGLE_APPLICATION_CREDENTIALS not set", file=sys.stderr)
            sys.exit(1)
        if not args.skip_images and not os.environ.get("STABILITY_API_KEY"):
            print("Error: STABILITY_API_KEY not set (use --skip-images to skip)", file=sys.stderr)
            sys.exit(1)

    hsk_words = load_hsk_words()
    index = load_word_index()

    if args.fix_capitalization:
        fixed = 0
        for entry in index.values():
            sp = entry.get("sentencePinyin", "")
            if sp and sp[0].islower():
                # Capitalize both dictionary and sandhi parts
                parts = sp.split(" Sandhi: ")
                parts = [p[0].upper() + p[1:] if p else p for p in parts]
                entry["sentencePinyin"] = " Sandhi: ".join(parts)
                fixed += 1
        if fixed:
            save_word_index(index)
        print(f"Fixed capitalization for {fixed} entries")
        return

    if args.generate_missing_images:
        entries_without_images = [
            v for v in index.values()
            if v.get("source") == "generated" and not v.get("sentenceImage")
        ]
        print(f"Entries missing images: {len(entries_without_images)}")
        if not entries_without_images:
            print("All generated entries have images!")
            return

        claude_client = anthropic.Anthropic()
        stability_key = os.environ.get("STABILITY_API_KEY", "")

        for i in range(0, len(entries_without_images), BATCH_SIZE):
            batch = entries_without_images[i:i + BATCH_SIZE]
            process_missing_images(batch, index, claude_client, stability_key)
        return

    missing = find_missing(hsk_words, index)

    print(f"Total HSK words: {len(hsk_words)}")
    print(f"Already in index: {len(index)}")
    print(f"Missing: {len(missing)}")

    if args.word:
        if args.regenerate and args.word in index:
            # Remove from index so it gets regenerated
            del index[args.word]
            save_word_index(index)
            missing = find_missing(hsk_words, index)
        missing = [w for w in missing if w["simplified"] == args.word]
        if not missing:
            # Check if it's already in the index
            if args.word in index:
                print(f"'{args.word}' already has card data (use --regenerate to redo)")
            else:
                print(f"'{args.word}' not found in HSK word list")
            return

    if args.limit:
        missing = missing[:args.limit]

    if not missing:
        print("Nothing to generate!")
        return

    print(f"Will generate: {len(missing)} words")

    if args.dry_run:
        print("\nDry run — listing words that would be generated:")
        for w in missing:
            print(f"  {w['simplified']} ({w['pinyin']}): {w['meaning']} [{w['partOfSpeech']}]")
        return

    # Initialize clients
    claude_client = anthropic.Anthropic()
    tts_client = texttospeech.TextToSpeechClient()
    stability_key = os.environ.get("STABILITY_API_KEY", "")

    # Process in batches
    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(missing) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\n{'='*60}")
        print(f"Batch {batch_num}/{total_batches}")
        print(f"{'='*60}")

        process_batch(
            batch, index, claude_client, tts_client, stability_key,
            skip_images=args.skip_images,
        )


if __name__ == "__main__":
    main()
