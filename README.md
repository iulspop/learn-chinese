# Learn Chinese - HSK Vocabulary Tracker

Browse and track HSK 1-9 vocabulary, visualize frequency coverage, and export to Anki.

## Stack

- **Frontend**: React Router v7 (framework mode), TanStack Table + Virtual, Tailwind CSS
- **Export server**: Python Flask + genanki (generates `.apkg` Anki decks)
- **Data**: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) with word frequency ranks

## Setup

### 1. Install dependencies

```bash
# Frontend
npm install

# Python export server (requires uv: https://docs.astral.sh/uv/)
cd python-server && uv sync
```

### 2. Set up Anki deck sources

The export enriches cards with sentences, audio, and images from two Anki decks. You need to download and export them using the CrowdAnki add-on.

1. Install the [CrowdAnki](https://github.com/Stvad/CrowdAnki) add-on in Anki (code: `1788670778`)
2. Download and import both decks from [https://refold.link/mandarinDeck](https://refold.link/mandarinDeck):
   - **Refold Mandarin 1k Simplified**
   - **Mandarin HSK 1000-5000**
3. Export each deck via CrowdAnki: `File > Export > CrowdAnki JSON representation`
4. Place the exported directories in `decks/`:
   ```
   decks/
   ├── Refold_Mandarin_1k_Simplified/
   │   ├── deck.json
   │   └── media/
   └── Mandarin_HSK_1000-5000/
       ├── deck.json
       └── media/
   ```

### 3. Build the word index

```bash
npm run build:index
```

This generates `app/data/word-index.json` and copies media files to `app/data/media/`. Both are gitignored build artifacts.

## Running

You need both the frontend dev server and the Python export server running:

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Python export server
cd python-server && uv run server.py
```

The frontend runs at `http://localhost:5173` and the export server at `http://localhost:5001`.

## Features

- **Browse HSK vocabulary** by level (1-6, 7-9) with sortable columns and search
- **Track words** individually or bulk track/untrack entire levels
- **Frequency coverage chart** showing how your tracked words cover the most common Chinese words
- **Column visibility** toggle for HSK, Freq, Pinyin, and Deck columns (persisted via cookies)
- **Export to Anki** with card type selection (Pinyin→Meaning, Character→Meaning):
  - Cards enriched with sentences, audio, images, and part of speech from deck sources
  - Hoverable pinyin on Character→Meaning cards
  - Preview with playable audio before exporting
  - Stable GUIDs so re-importing preserves review progress
