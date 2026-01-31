import fs from "node:fs";
import path from "node:path";
import type { HskWord, TrackedWords, WordWithTracking, FrequencyStats, WordIndexEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "app", "data");
const COMPLETE_PATH = path.join(DATA_DIR, "complete.json");
const TRACKED_PATH = path.join(DATA_DIR, "tracked-words.json");
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
  const wordIndex = getWordIndex();
  const filtered = level ? allWords.filter((w) => w.hskLevel === level) : allWords;

  return filtered.map((w) => ({
    ...w,
    isTracked: tracked.has(w.id),
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

const BUCKET_SIZE = 500;
const NUM_BUCKETS = 20; // covers frequency ranks 1-10000

export function getFrequencyStats(level?: number): FrequencyStats {
  const allWords = getAllWords();
  const trackedSet = new Set(getTrackedWords().tracked);

  // HSK 7 tab: show all words (1-9). Other tabs: show only HSK 1-6.
  const filtered = level === 7
    ? allWords
    : allWords.filter((w) => w.hskLevel <= 6);

  const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => ({
    rangeLabel: `${i * BUCKET_SIZE + 1}-${(i + 1) * BUCKET_SIZE}`,
    min: i * BUCKET_SIZE + 1,
    max: (i + 1) * BUCKET_SIZE,
    hskCount: 0,
    trackedCount: 0,
  }));

  let totalTracked = 0;
  let topNTotal = 0;
  let topNTracked = 0;
  let levelWords = 0;
  let levelTracked = 0;
  const TOP_N = 5000;

  for (const word of filtered) {
    if (trackedSet.has(word.id)) {
      totalTracked++;
    }
    if (level === 7 && word.hskLevel === 7) {
      levelWords++;
      if (trackedSet.has(word.id)) {
        levelTracked++;
      }
    }
    const freq = word.frequency;
    const bucketIndex = Math.min(Math.floor((freq - 1) / BUCKET_SIZE), NUM_BUCKETS - 1);
    if (bucketIndex >= 0 && bucketIndex < NUM_BUCKETS) {
      buckets[bucketIndex].hskCount++;
      if (trackedSet.has(word.id)) {
        buckets[bucketIndex].trackedCount++;
      }
    }

    if (freq <= TOP_N) {
      topNTotal++;
      if (trackedSet.has(word.id)) {
        topNTracked++;
      }
    }
  }

  const coveragePercent = topNTotal > 0
    ? Math.round((topNTracked / topNTotal) * 100)
    : 0;

  return {
    buckets, totalWords: filtered.length, totalTracked, topNTotal, topNTracked, coveragePercent,
    ...(level === 7 ? { levelWords, levelTracked } : {}),
  };
}
