import json
import os
import hashlib
import genanki
from flask import Flask, jsonify

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPLETE_PATH = os.path.join(BASE_DIR, "app", "data", "complete.json")
TRACKED_PATH = os.path.join(BASE_DIR, "app", "data", "tracked-words.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "hsk-vocabulary.apkg")

# Stable model IDs (hardcoded so reimport preserves review progress)
BEGINNER_MODEL_ID = 1607392319
ADVANCED_MODEL_ID = 1607392320

CARD_CSS = """\
.card {
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  text-align: center;
  font-size: 20px;
  color: #1a1a1a;
  background: #fff;
  padding: 2rem;
}
.character { font-size: 48px; margin-bottom: 0.5rem; }
.pinyin { font-size: 24px; color: #0369a1; margin-bottom: 0.5rem; }
.meaning { font-size: 20px; color: #374151; }
.hsk-level { font-size: 14px; color: #9ca3af; margin-top: 1rem; }
"""

BEGINNER_MODEL = genanki.Model(
    BEGINNER_MODEL_ID,
    "HSK Vocabulary (Beginner)",
    fields=[
        {"name": "Character"},
        {"name": "Pinyin"},
        {"name": "Meaning"},
        {"name": "HSKLevel"},
    ],
    templates=[
        {
            "name": "Pinyin → Meaning",
            "qfmt": '<div class="pinyin">{{Pinyin}}</div><div class="hsk-level">HSK {{HSKLevel}}</div>',
            "afmt": '{{FrontSide}}<hr><div class="meaning">{{Meaning}}</div><div class="character">{{Character}}</div>',
        },
        {
            "name": "Character → Pronunciation",
            "qfmt": '<div class="character">{{Character}}</div><div class="hsk-level">HSK {{HSKLevel}}</div>',
            "afmt": '{{FrontSide}}<hr><div class="pinyin">{{Pinyin}}</div><div class="meaning">{{Meaning}}</div>',
        },
        {
            "name": "Character → Meaning",
            "qfmt": '<div class="character">{{Character}}</div><div class="hsk-level">HSK {{HSKLevel}}</div>',
            "afmt": '{{FrontSide}}<hr><div class="meaning">{{Meaning}}</div><div class="pinyin">{{Pinyin}}</div>',
        },
    ],
    css=CARD_CSS,
)

ADVANCED_MODEL = genanki.Model(
    ADVANCED_MODEL_ID,
    "HSK Vocabulary (Advanced)",
    fields=[
        {"name": "Character"},
        {"name": "Pinyin"},
        {"name": "Meaning"},
        {"name": "HSKLevel"},
    ],
    templates=[
        {
            "name": "Character → Meaning",
            "qfmt": '<div class="character">{{Character}}</div><div class="hsk-level">HSK {{HSKLevel}}</div>',
            "afmt": '{{FrontSide}}<hr><div class="meaning">{{Meaning}}</div><div class="pinyin">{{Pinyin}}</div>',
        },
    ],
    css=CARD_CSS,
)

DECK_ID = 2059400110


def stable_guid(word_id: str, mode: str) -> str:
    """Generate a stable GUID from word_id and mode so reimport preserves progress."""
    h = hashlib.sha256(f"{word_id}:{mode}".encode()).hexdigest()
    return h[:10]


def parse_level(level_str: str):
    if level_str.startswith("new-"):
        try:
            return int(level_str[4:])
        except ValueError:
            return None
    return None


def load_words():
    with open(COMPLETE_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    words = {}
    for entry in raw:
        new_level = None
        for lv in entry.get("level", []):
            parsed = parse_level(lv)
            if parsed is not None and parsed <= 6:
                new_level = parsed
                break
        if new_level is None:
            continue

        form = entry["forms"][0] if entry.get("forms") else None
        if not form:
            continue

        word_id = entry["simplified"]
        words[word_id] = {
            "id": word_id,
            "character": word_id,
            "pinyin": form["transcriptions"]["pinyin"],
            "meaning": "; ".join(form["meanings"]),
            "hsk_level": new_level,
        }
    return words


def load_tracked():
    with open(TRACKED_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["tracked"]


@app.route("/export-anki", methods=["POST"])
def export_anki():
    try:
        all_words = load_words()
        tracked_ids = load_tracked()
        tracked_words = [all_words[wid] for wid in tracked_ids if wid in all_words]

        if not tracked_words:
            return jsonify({"error": "No tracked words to export"}), 400

        is_beginner = len(tracked_words) < 200
        mode = "beginner" if is_beginner else "advanced"
        model = BEGINNER_MODEL if is_beginner else ADVANCED_MODEL

        deck = genanki.Deck(DECK_ID, "HSK Vocabulary")

        for word in tracked_words:
            note = genanki.Note(
                model=model,
                fields=[
                    word["character"],
                    word["pinyin"],
                    word["meaning"],
                    str(word["hsk_level"]),
                ],
                guid=stable_guid(word["id"], mode),
            )
            deck.add_note(note)

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        genanki.Package(deck).write_to_file(OUTPUT_PATH)

        return jsonify({
            "success": True,
            "path": OUTPUT_PATH,
            "word_count": len(tracked_words),
            "mode": mode,
            "cards_per_word": 3 if is_beginner else 1,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
