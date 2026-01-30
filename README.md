# Learn Chinese - HSK Vocabulary Tracker

Browse and track HSK 1-9 vocabulary, visualize frequency coverage, and export to Anki.

## Stack

- **Frontend**: React Router v7 (framework mode), TanStack Table + Virtual, Tailwind CSS
- **Export server**: Python Flask + genanki (generates `.apkg` Anki decks)
- **Data**: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) with word frequency ranks

## Setup

```bash
# Install frontend dependencies
npm install

# Install Python dependencies (requires uv: https://docs.astral.sh/uv/)
cd python-server && uv sync
```

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

- **Browse HSK vocabulary** by level (1-6, 7-9) with sortable columns
- **Track words** individually or bulk track/untrack entire levels
- **Frequency coverage chart** showing how your tracked words cover the most common Chinese words
- **Export to Anki** downloads an `.apkg` deck file:
  - Under 200 tracked words: beginner mode (3 card types per word)
  - 200+ tracked words: advanced mode (1 card type per word)
  - Stable GUIDs so re-importing preserves review progress
