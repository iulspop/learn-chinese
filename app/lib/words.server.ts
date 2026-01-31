import fs from "node:fs";
import path from "node:path";
import type { HskWord, HskWordWithDeck, WordIndexEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const COMPLETE_PATH = path.join(DATA_DIR, "complete.json");
const INDEX_PATH = path.join(DATA_DIR, "word-index.json");

function parseLevel(levelStr: string): number | null {
  const match = levelStr.match(/^new-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

let cachedWords: HskWord[] | null = null;

export function getAllWords(): HskWord[] {
  if (cachedWords) return cachedWords;

  const raw = JSON.parse(fs.readFileSync(COMPLETE_PATH, "utf-8")) as Array<{
    simplified: string;
    frequency: number;
    level: string[];
    forms: Array<{
      transcriptions: { pinyin: string };
      meanings: string[];
    }>;
  }>;

  const words: HskWord[] = [];

  for (const entry of raw) {
    const newLevel = entry.level
      .map(parseLevel)
      .find((l): l is number => l !== null);
    if (newLevel == null) continue;

    const form = entry.forms[0];
    if (!form) continue;

    words.push({
      id: entry.simplified,
      character: entry.simplified,
      pinyin: form.transcriptions.pinyin,
      meaning: form.meanings.join("; "),
      hskLevel: newLevel,
      frequency: entry.frequency,
    });
  }

  words.sort((a, b) => a.hskLevel - b.hskLevel || a.pinyin.localeCompare(b.pinyin));
  cachedWords = words;
  return words;
}

export function getWords(level?: number): HskWordWithDeck[] {
  const allWords = getAllWords();
  const wordIndex = getWordIndex();
  const filtered = level ? allWords.filter((w) => w.hskLevel === level) : allWords;

  return filtered.map((w) => ({
    ...w,
    hasIndex: w.id in wordIndex,
  }));
}

let cachedIndex: Record<string, WordIndexEntry> | null = null;

export function getWordIndex(): Record<string, WordIndexEntry> {
  if (cachedIndex) return cachedIndex;
  if (!fs.existsSync(INDEX_PATH)) return {};
  cachedIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  return cachedIndex!;
}
