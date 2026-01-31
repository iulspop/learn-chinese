import fs from "node:fs";
import path from "node:path";
import type { HskWord, TrackedWords, WordWithTracking, FrequencyStats, WordIndexEntry, CoverageCurveData } from "./types";

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

const R = 10000;

function harmonicNumber(n: number): number {
  let sum = 0;
  for (let k = 1; k <= n; k++) {
    sum += 1 / k;
  }
  return sum;
}

const H_R = harmonicNumber(R);

// Build sorted array of 1/rank values and a prefix-sum array.
// cumulativeAt(prefixSums, sortedRanks, n) returns the harmonic sum for all entries with rank <= n.
function buildPrefixSums(ranks: number[]): { sorted: number[]; prefix: number[] } {
  const sorted = ranks.slice().sort((a, b) => a - b);
  const prefix: number[] = new Array(sorted.length);
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += 1 / sorted[i];
    prefix[i] = sum;
  }
  return { sorted, prefix };
}

function cumulativeAt(sorted: number[], prefix: number[], n: number): number {
  if (n <= 0 || sorted.length === 0) return 0;
  // Binary search for last index where sorted[i] <= n
  let lo = 0, hi = sorted.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= n) { result = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return result >= 0 ? prefix[result] : 0;
}

export function getCoverageCurve(level?: number): CoverageCurveData {
  const allWords = getAllWords();
  const trackedSet = new Set(getTrackedWords().tracked);

  // Collect all frequency ranks (with duplicates) per group
  const hsk16Ranks: number[] = [];
  const hsk79Ranks: number[] = [];
  const trackedRanks: number[] = [];

  for (const word of allWords) {
    if (word.frequency >= 1 && word.frequency <= R) {
      if (word.hskLevel <= 6) {
        hsk16Ranks.push(word.frequency);
      } else {
        hsk79Ranks.push(word.frequency);
      }
      if (trackedSet.has(word.id)) {
        trackedRanks.push(word.frequency);
      }
    }
  }

  const hsk16 = buildPrefixSums(hsk16Ranks);
  const hsk79 = buildPrefixSums(hsk79Ranks);
  const tracked = buildPrefixSums(trackedRanks);

  // Sample points at varying density
  const sampleRanks: number[] = [];
  for (let r = 0; r <= 1000; r += 50) sampleRanks.push(r);
  for (let r = 1100; r <= 3000; r += 100) sampleRanks.push(r);
  for (let r = 3250; r <= 5000; r += 250) sampleRanks.push(r);
  for (let r = 5500; r <= R; r += 500) sampleRanks.push(r);

  const points = sampleRanks.map((n) => {
    const zipfPercent = n === 0 ? 0 : (harmonicNumber(n) / H_R) * 100;
    const h16 = cumulativeAt(hsk16.sorted, hsk16.prefix, n);
    const h79 = cumulativeAt(hsk79.sorted, hsk79.prefix, n);
    const ht = cumulativeAt(tracked.sorted, tracked.prefix, n);

    return {
      rank: n,
      zipfPercent,
      hsk16Percent: (h16 / H_R) * 100,
      hskAllPercent: ((h16 + h79) / H_R) * 100,
      trackedPercent: (ht / H_R) * 100,
    };
  });

  // Total coverage (last entry in prefix sums)
  const totalHsk16 = hsk16.prefix.length > 0 ? hsk16.prefix[hsk16.prefix.length - 1] : 0;
  const totalHsk79 = hsk79.prefix.length > 0 ? hsk79.prefix[hsk79.prefix.length - 1] : 0;
  const totalTracked = tracked.prefix.length > 0 ? tracked.prefix[tracked.prefix.length - 1] : 0;

  return {
    points,
    totalHsk16Percent: Math.round((totalHsk16 / H_R) * 1000) / 10,
    totalHskAllPercent: Math.round(((totalHsk16 + totalHsk79) / H_R) * 1000) / 10,
    totalTrackedPercent: Math.round((totalTracked / H_R) * 1000) / 10,
  };
}
