import json
import os
import hashlib
import glob
import genanki
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPLETE_PATH = os.path.join(BASE_DIR, "app", "data", "complete.json")
TRACKED_PATH = os.path.join(BASE_DIR, "app", "data", "tracked-words.json")
INDEX_PATH = os.path.join(BASE_DIR, "app", "data", "word-index.json")
MEDIA_DIR = os.path.join(BASE_DIR, "app", "data", "media")
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
.hanzi {
  font-family: Kai;
  font-size: 78px;
  border-bottom: 3px solid rgba(0, 0, 0, 0);
  transition: border 0.5s ease, padding 0.5s ease;
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
  transition: padding 0.5s ease;
}
.pinyinSen {
  font-family: Palatino;
  font-size: 20px;
  color: #55DD55;
  text-align: left;
}
.pinyinSen.whover {
  cursor: pointer;
  border-left: 3px solid white;
  padding-left: 10px;
  height: 25px;
  max-height: 80px;
  display: flex;
  padding-top: 55px;
  transform: translate(-10px, -50px);
  opacity: 0;
  transition: opacity 0.5s ease;
  white-space: nowrap;
}
.pinyinSen.whover:hover {
  opacity: 1;
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
.image {
  margin-top: 20px;
  border-left: 3px solid white;
  padding-left: 10px;
}
"""

# Sentence block used in both templates (conditionally rendered)
SENTENCE_BLOCK_FRONT = (
    "{{#SentenceSimplified}}"
    '<div lang="zh-Hans" class="sentence">{{SentenceSimplified}}</div>'
    '<div class="pinyinSen whover">{{SentencePinyin}}</div>'
    "{{/SentenceSimplified}}"
    "{{^SentenceSimplified}}"
    '<div class="stub">(example sentence coming soon)</div>'
    "{{/SentenceSimplified}}"
)

SENTENCE_BLOCK_BACK = (
    "{{#SentenceSimplified}}"
    '<div lang="zh-Hans" class="sentence">{{SentenceSimplified}}</div>'
    '<div class="pinyinSen">{{SentencePinyin}}</div>'
    '<div class="meaningSent">{{SentenceMeaning}}</div>'
    "{{/SentenceSimplified}}"
    "{{^SentenceSimplified}}"
    '<div class="stub">(example sentence coming soon)</div>'
    "{{/SentenceSimplified}}"
    "{{#Audio}}{{Audio}}{{/Audio}}"
    "{{#SentenceAudio}} {{SentenceAudio}}{{/SentenceAudio}}"
    "{{#SentenceImage}}<div class=\"image\">{{SentenceImage}}</div>{{/SentenceImage}}"
)

HSK_FIELDS = [
    {"name": "Character"},
    {"name": "Pinyin"},
    {"name": "Meaning"},
    {"name": "HSKLevel"},
    {"name": "PartOfSpeech"},
    {"name": "Audio"},
    {"name": "SentenceSimplified"},
    {"name": "SentencePinyin"},
    {"name": "SentenceMeaning"},
    {"name": "SentenceAudio"},
    {"name": "SentenceImage"},
]

ALL_TEMPLATES = {
    "pinyin-meaning": {
        "name": "Pinyin \u2192 Meaning",
        "qfmt": (
            '<div class="pinyin">{{Pinyin}}</div>'
            "{{#PartOfSpeech}}"
            '<div class="description">{{PartOfSpeech}}</div>'
            "{{/PartOfSpeech}}"
            "<hr>"
            + SENTENCE_BLOCK_FRONT
        ),
        "afmt": (
            '<div lang="zh-Hans" class="hanzi">{{Character}}</div>'
            '<div class="pinyin">{{Pinyin}}</div>'
            '<div class="english">{{Meaning}}</div>'
            "{{#PartOfSpeech}}"
            '<div class="description">{{PartOfSpeech}}</div>'
            "{{/PartOfSpeech}}"
            "<hr>"
            + SENTENCE_BLOCK_BACK
        ),
    },
    "character-meaning": {
        "name": "Character \u2192 Meaning",
        "qfmt": (
            '<div lang="zh-Hans" class="hanzi whover" style="--pinyin: \'{{Pinyin}}\'">{{Character}}</div>'
            '<div class="pinyin"><br></div>'
            '<div class="english"><br></div>'
            '<div class="description"><br></div>'
            "<hr>"
            + SENTENCE_BLOCK_FRONT
        ),
        "afmt": (
            '<div lang="zh-Hans" class="hanzi">{{Character}}</div>'
            '<div class="pinyin">{{Pinyin}}</div>'
            '<div class="english">{{Meaning}}</div>'
            "{{#PartOfSpeech}}"
            '<div class="description">{{PartOfSpeech}}</div>'
            "{{/PartOfSpeech}}"
            "<hr>"
            + SENTENCE_BLOCK_BACK
        ),
    },
}


def build_model(template_ids=None):
    if template_ids is None:
        template_ids = list(ALL_TEMPLATES.keys())
    templates = [ALL_TEMPLATES[tid] for tid in template_ids if tid in ALL_TEMPLATES]
    if not templates:
        templates = list(ALL_TEMPLATES.values())
    return genanki.Model(
        MODEL_ID,
        "HSK Vocabulary",
        fields=HSK_FIELDS,
        templates=templates,
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


def load_word_index():
    if not os.path.exists(INDEX_PATH):
        return {}
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/export-anki", methods=["POST"])
def export_anki():
    try:
        body = request.get_json(silent=True) or {}
        template_ids = body.get("templates")

        model = build_model(template_ids)

        all_words = load_words()
        tracked_ids = load_tracked()
        tracked_words = [all_words[wid] for wid in tracked_ids if wid in all_words]

        if not tracked_words:
            return jsonify({"error": "No tracked words to export"}), 400

        word_index = load_word_index()
        deck = genanki.Deck(DECK_ID, "HSK Vocabulary")
        media_files = []

        for word in tracked_words:
            idx = word_index.get(word["character"], {})

            audio = f'[sound:{idx["audio"]}]' if idx.get("audio") else ""
            sen_audio = f'[sound:{idx["sentenceAudio"]}]' if idx.get("sentenceAudio") else ""
            sen_image = f'<img src="{idx["sentenceImage"]}">' if idx.get("sentenceImage") else ""

            # Collect media files
            for f_name in [idx.get("audio"), idx.get("sentenceAudio"), idx.get("sentenceImage")]:
                if f_name:
                    f_path = os.path.join(MEDIA_DIR, f_name)
                    if os.path.exists(f_path) and f_path not in media_files:
                        media_files.append(f_path)

            note = genanki.Note(
                model=model,
                fields=[
                    word["character"],
                    word["pinyin"],
                    word["meaning"],
                    str(word["hsk_level"]),
                    idx.get("partOfSpeech", ""),
                    audio,
                    idx.get("sentence", ""),
                    idx.get("sentencePinyin", ""),
                    idx.get("sentenceMeaning", ""),
                    sen_audio,
                    sen_image,
                ],
                guid=stable_guid(word["id"], "hsk"),
            )
            deck.add_note(note)

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        pkg = genanki.Package(deck)
        pkg.media_files = media_files
        pkg.write_to_file(OUTPUT_PATH)

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
