import fs from "node:fs";
import path from "node:path";
import type { HskWord, TrackedWords, WordWithTracking } from "./types";

const DATA_DIR = path.join(process.cwd(), "app", "data");
const COMPLETE_PATH = path.join(DATA_DIR, "complete.json");
const TRACKED_PATH = path.join(DATA_DIR, "tracked-words.json");

function parseLevel(levelStr: string): number | null {
  const match = levelStr.match(/^new-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

let cachedWords: HskWord[] | null = null;

export function getAllWords(): HskWord[] {
  if (cachedWords) return cachedWords;

  const raw = JSON.parse(fs.readFileSync(COMPLETE_PATH, "utf-8")) as Array<{
    simplified: string;
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
    if (newLevel == null || newLevel > 6) continue;

    const form = entry.forms[0];
    if (!form) continue;

    words.push({
      id: entry.simplified,
      character: entry.simplified,
      pinyin: form.transcriptions.pinyin,
      meaning: form.meanings.join("; "),
      hskLevel: newLevel,
    });
  }

  words.sort((a, b) => a.hskLevel - b.hskLevel || a.pinyin.localeCompare(b.pinyin));
  cachedWords = words;
  return words;
}

export function getTrackedWords(): TrackedWords {
  const raw = fs.readFileSync(TRACKED_PATH, "utf-8");
  return JSON.parse(raw) as TrackedWords;
}

function saveTrackedWords(data: TrackedWords): void {
  fs.writeFileSync(TRACKED_PATH, JSON.stringify(data, null, 2) + "\n");
}

export function toggleWord(wordId: string): void {
  const data = getTrackedWords();
  const index = data.tracked.indexOf(wordId);
  if (index === -1) {
    data.tracked.push(wordId);
  } else {
    data.tracked.splice(index, 1);
  }
  saveTrackedWords(data);
}

export function trackAllInLevel(level: number): void {
  const allWords = getAllWords();
  const levelWords = allWords.filter((w) => w.hskLevel === level);
  const data = getTrackedWords();
  const trackedSet = new Set(data.tracked);

  for (const word of levelWords) {
    trackedSet.add(word.id);
  }

  data.tracked = Array.from(trackedSet);
  saveTrackedWords(data);
}

export function untrackAllInLevel(level: number): void {
  const allWords = getAllWords();
  const levelWordIds = new Set(
    allWords.filter((w) => w.hskLevel === level).map((w) => w.id)
  );
  const data = getTrackedWords();
  data.tracked = data.tracked.filter((id) => !levelWordIds.has(id));
  saveTrackedWords(data);
}

export function getWordsWithTracking(level?: number): WordWithTracking[] {
  const allWords = getAllWords();
  const tracked = new Set(getTrackedWords().tracked);
  const filtered = level ? allWords.filter((w) => w.hskLevel === level) : allWords;

  return filtered.map((w) => ({
    ...w,
    isTracked: tracked.has(w.id),
  }));
}
