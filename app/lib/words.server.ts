import path from "node:path";
import Database from "better-sqlite3";
import type { HskWord, HskWordWithDeck, WordIndexEntry } from "./types";

export type HskVersion = "2.0" | "3.0";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "words.db");

let db: ReturnType<typeof Database> | null = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

const cachedWords = new Map<HskVersion, HskWord[]>();

export function getAllWords(version: HskVersion = "3.0"): HskWord[] {
  const cached = cachedWords.get(version);
  if (cached) return cached;

  const col = version === "2.0" ? "hsk_level_v2" : "hsk_level_v3";
  const rows = getDb()
    .prepare(
      `SELECT simplified, pinyin, meaning, ${col} AS hsk_level, frequency
       FROM words
       WHERE ${col} IS NOT NULL
       ORDER BY ${col}, pinyin`
    )
    .all() as Array<{
    simplified: string;
    pinyin: string;
    meaning: string;
    hsk_level: number;
    frequency: number;
  }>;

  const words: HskWord[] = rows.map((r) => ({
    id: r.simplified,
    character: r.simplified,
    pinyin: r.pinyin,
    meaning: r.meaning,
    hskLevel: r.hsk_level,
    frequency: r.frequency,
  }));

  cachedWords.set(version, words);
  return words;
}

export function getWords(level?: number, version: HskVersion = "3.0"): HskWordWithDeck[] {
  const allWords = getAllWords(version);
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

  const rows = getDb()
    .prepare("SELECT * FROM word_cards")
    .all() as Array<{
    simplified: string;
    pinyin: string;
    meaning: string;
    part_of_speech: string;
    audio: string;
    sentence: string;
    sentence_pinyin: string;
    sentence_meaning: string;
    sentence_audio: string;
    sentence_image: string;
    card_source: string;
  }>;

  const index: Record<string, WordIndexEntry> = {};
  for (const r of rows) {
    index[r.simplified] = {
      simplified: r.simplified,
      pinyin: r.pinyin ?? "",
      meaning: r.meaning ?? "",
      partOfSpeech: r.part_of_speech ?? "",
      audio: r.audio ?? "",
      sentence: r.sentence ?? "",
      sentencePinyin: r.sentence_pinyin ?? "",
      sentenceMeaning: r.sentence_meaning ?? "",
      sentenceAudio: r.sentence_audio ?? "",
      sentenceImage: r.sentence_image ?? "",
      source: r.card_source ?? "",
    };
  }

  cachedIndex = index;
  return cachedIndex;
}
