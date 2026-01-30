import json
import os
import hashlib
import genanki
from flask import Flask, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPLETE_PATH = os.path.join(BASE_DIR, "app", "data", "complete.json")
TRACKED_PATH = os.path.join(BASE_DIR, "app", "data", "tracked-words.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "hsk-vocabulary.apkg")

MODEL_ID = 1607392319

CARD_CSS = """\
hr {
  height: 3px;
  background: white;
  border: none;
  margin-top: 20px;
  margin-bottom: 20px;
}
div {
  margin-bottom: 10px;
}
.card {
  font-family: Georgia;
  font-size: 10px;
  text-align: left;
  background-color: rgb(47, 47, 49);
  color: #fff;
  padding: 20px;
}
.recall-prompt {
  font-family: Didot;
  font-size: 13px;
  color: #575757;
  margin-bottom: 15px;
}
.hanzi {
  font-family: Kai;
  font-size: 78px;
  margin-top: 20px;
}
.hanzi.whover {
  cursor: pointer;
}
.hanzi.whover::before {
  font-family: Palatino;
  content: var(--pinyin);
  position: absolute;
  font-size: 22px;
  color: #55DD55;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 5px;
  border-left: 3px solid white;
  transform: translate(-10px, -40px);
  opacity: 0;
  transition: opacity 0.5s ease;
  height: 140px;
  padding-top: 0px;
}
.hanzi.whover:hover::before {
  opacity: 1;
}
.pinyin {
  font-family: Palatino;
  font-size: 22px;
  color: #55DD55;
}
.english {
  font-family: Didot;
  font-size: 16px;
}
.description {
  font-family: Didot;
  font-size: 16px;
  color: #575757;
}
.sentence {
  font-family: Kai;
  font-size: 30px;
  text-align: left;
}
.pinyinSen {
  font-family: Palatino;
  font-size: 20px;
  color: #55DD55;
  text-align: left;
}
.meaningSent {
  font-family: Didot;
  font-size: 16px;
  text-align: left;
}
.stub {
  font-family: Didot;
  font-size: 14px;
  color: #575757;
  font-style: italic;
}
"""

HSK_MODEL = genanki.Model(
    MODEL_ID,
    "HSK Vocabulary",
    fields=[
        {"name": "Character"},
        {"name": "Pinyin"},
        {"name": "Meaning"},
        {"name": "HSKLevel"},
    ],
    templates=[
        {
            "name": "Pinyin \u2192 Meaning",
            "qfmt": (
                ""
                '<div class="pinyin">{{Pinyin}}</div>'
                "<hr>"
                '<div class="stub">(example sentence coming soon)</div>'
            ),
            "afmt": (
                ""
                '<div lang="zh-Hans" class="hanzi">{{Character}}</div>'
                '<div class="pinyin">{{Pinyin}}</div>'
                '<div class="english">{{Meaning}}</div>'
                "<hr>"
                '<div class="stub">(example sentence coming soon)</div>'
            ),
        },
        {
            "name": "Character \u2192 Meaning",
            "qfmt": (
                ""
                '<div lang="zh-Hans" class="hanzi whover" style="--pinyin: \'{{Pinyin}}\'">{{Character}}</div>'
                '<div class="pinyin"><br></div>'
                "<hr>"
                '<div class="stub">(example sentence coming soon)</div>'
            ),
            "afmt": (
                ""
                '<div lang="zh-Hans" class="hanzi">{{Character}}</div>'
                '<div class="pinyin">{{Pinyin}}</div>'
                '<div class="english">{{Meaning}}</div>'
                "<hr>"
                '<div class="stub">(example sentence coming soon)</div>'
            ),
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
            if parsed is not None:
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

        deck = genanki.Deck(DECK_ID, "HSK Vocabulary")

        for word in tracked_words:
            note = genanki.Note(
                model=HSK_MODEL,
                fields=[
                    word["character"],
                    word["pinyin"],
                    word["meaning"],
                    str(word["hsk_level"]),
                ],
                guid=stable_guid(word["id"], "hsk"),
            )
            deck.add_note(note)

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        genanki.Package(deck).write_to_file(OUTPUT_PATH)

        return send_file(
            OUTPUT_PATH,
            as_attachment=True,
            download_name="hsk-vocabulary.apkg",
            mimetype="application/octet-stream",
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
