import { useMemo } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import type { Route } from "./+types/words";
import { getWords, getWordIndex, type HskVersion } from "~/lib/words.server";
import { WordList, type WordListPrefs } from "~/components/word-list";
import { FrequencyCoverage } from "~/components/frequency-coverage";
import { useTrackedWords } from "~/hooks/use-tracked-words";
import { computeFrequencyStats, computeCoverageCurve } from "~/lib/stats";
import type { WordWithTracking, HskWordWithDeck } from "~/lib/types";

const HSK_LEVELS_V3 = [1, 2, 3, 4, 5, 6, 7] as const;
const HSK_LEVELS_V2 = [1, 2, 3, 4, 5, 6] as const;
const HSK_LEVEL_LABELS: Record<number, string> = { 7: "7-9" };

function parseCookie<T>(cookieHeader: string | null, key: string, fallback: T): T {
  if (!cookieHeader) return fallback;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
  if (!match) return fallback;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as T;
  } catch {
    return fallback;
  }
}

function parseCookieRaw(cookieHeader: string | null, key: string, fallback: string): string {
  if (!cookieHeader) return fallback;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : fallback;
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const levelParam = url.searchParams.get("level");
  const level = levelParam ? parseInt(levelParam, 10) : undefined;
  const cookieHeader = request.headers.get("cookie");

  const version = parseCookieRaw(cookieHeader, "hsk-version", "3.0") as HskVersion;
  const maxLevel = version === "2.0" ? 6 : 7;

  // If on a level that doesn't exist in this version, ignore the level filter
  const effectiveLevel = level && level <= maxLevel ? level : undefined;

  const allWords = getWords(undefined, version);
  const words = effectiveLevel ? allWords.filter((w) => w.hskLevel === effectiveLevel) : allWords;

  const freqView = parseCookie<"bars" | "coverage">(cookieHeader, "freq-view", "bars");
  const wordListPrefs: WordListPrefs = {
    columnVisibility: parseCookie(cookieHeader, "wl-col-visibility", { hasIndex: false, hskLevel: false, frequency: false }),
    sorting: parseCookie(cookieHeader, "wl-sorting", [{ id: "frequency", desc: false }]),
    columnFilters: parseCookie(cookieHeader, "wl-col-filters", []),
    searchField: parseCookie(cookieHeader, "wl-search-field", "all" as const),
    pinTracked: parseCookie(cookieHeader, "wl-pin-tracked", true),
  };

  const wordIndex = getWordIndex();
  return { words, allWords, currentLevel: effectiveLevel ?? null, freqView, wordListPrefs, version, wordIndex };
}

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("hsk-cache", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("data")) {
        db.createObjectStore("data");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readonly");
    const req = tx.objectStore("data").get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, entries: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readwrite");
    const store = tx.objectStore("data");
    for (const [key, value] of Object.entries(entries)) {
      store.put(value, key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clientLoader({ serverLoader, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const levelParam = url.searchParams.get("level");
  const level = levelParam ? parseInt(levelParam, 10) : undefined;

  const cookieHeader = document.cookie;
  const version = parseCookieRaw(cookieHeader, "hsk-version", "3.0") as HskVersion;

  const raw = localStorage.getItem("tracked-words");
  const trackedIds: string[] = raw ? JSON.parse(raw) : [];

  try {
    if (localStorage.getItem("cached-all-words")) {
      localStorage.removeItem("cached-hsk-version");
      localStorage.removeItem("cached-all-words");
      localStorage.removeItem("cached-word-index");
    }

    const db = await openCacheDB();
    const [cachedVersion, cachedAllWords] = await Promise.all([
      idbGet<string>(db, "hsk-version"),
      idbGet<HskWordWithDeck[]>(db, "all-words"),
    ]);

    if (cachedVersion === version && cachedAllWords) {
      const maxLevel = version === "2.0" ? 6 : 7;
      const effectiveLevel = level && level <= maxLevel ? level : undefined;
      const words = effectiveLevel ? cachedAllWords.filter((w) => w.hskLevel === effectiveLevel) : cachedAllWords;

      const freqView = parseCookie<"bars" | "coverage">(cookieHeader, "freq-view", "bars");
      const wordListPrefs: WordListPrefs = {
        columnVisibility: parseCookie(cookieHeader, "wl-col-visibility", { hasIndex: false, hskLevel: false, frequency: false }),
        sorting: parseCookie(cookieHeader, "wl-sorting", [{ id: "frequency", desc: false }]),
        columnFilters: parseCookie(cookieHeader, "wl-col-filters", []),
        searchField: parseCookie(cookieHeader, "wl-search-field", "all" as const),
        pinTracked: parseCookie(cookieHeader, "wl-pin-tracked", true),
      };

      return { words, allWords: cachedAllWords, currentLevel: effectiveLevel ?? null, freqView, wordListPrefs, version, trackedIds };
    }

    const serverData = await serverLoader();
    await idbPut(db, { "hsk-version": serverData.version, "all-words": serverData.allWords, "word-index": serverData.wordIndex });
    return { ...serverData, trackedIds };
  } catch {
    // IndexedDB unavailable — fall back to server
    const serverData = await serverLoader();
    return { ...serverData, trackedIds };
  }
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="words-page">
      <header className="words-header">
        <h1>Chinese Anki Deck Builder</h1>
      </header>
    </div>
  );
}

export default function WordsRoute() {
  const { words, allWords, currentLevel, freqView, wordListPrefs, version } = useLoaderData<typeof clientLoader>();
  const { trackedWords, toggleWord, trackAll, untrackAll } = useTrackedWords();
  const navigate = useNavigate();

  const hskLevels = version === "2.0" ? HSK_LEVELS_V2 : HSK_LEVELS_V3;

  const wordsWithTracking: WordWithTracking[] = useMemo(
    () => words.map((w) => ({ ...w, isTracked: trackedWords.has(w.id) })),
    [words, trackedWords],
  );

  const frequencyStats = useMemo(
    () => computeFrequencyStats(allWords, trackedWords, currentLevel ?? undefined),
    [allWords, trackedWords, currentLevel],
  );

  const coverageCurve = useMemo(
    () => computeCoverageCurve(allWords, trackedWords),
    [allWords, trackedWords],
  );

  const trackedCount = trackedWords.size;
  const levelTrackedCount = wordsWithTracking.filter((w) => w.isTracked).length;
  const allLevelTracked = wordsWithTracking.length > 0 && levelTrackedCount === wordsWithTracking.length;

  const handleBulkToggle = () => {
    const levelWordIds = words.map((w) => w.id);
    if (allLevelTracked) {
      untrackAll(levelWordIds);
    } else {
      trackAll(levelWordIds);
    }
  };

  const handleVersionToggle = () => {
    const newVersion = version === "3.0" ? "2.0" : "3.0";
    document.cookie = `hsk-version=${newVersion};path=/;max-age=31536000;SameSite=Lax`;
    navigate("/words");
  };

  return (
    <div className="words-page">
      <header className="words-header">
        <div className="header-title-row">
          <h1>Chinese Anki Deck Builder</h1>
          <button type="button" className="version-toggle" onClick={handleVersionToggle}>
            HSK {version}
          </button>
        </div>
        <div className="header-info">
          <span className="tracked-badge">{trackedCount} words tracked</span>
          <Link to="/export" className="export-btn">
            Export to Anki
          </Link>
        </div>
      </header>

      <nav className="level-tabs">
        <Link
          to="/words"
          className={`level-tab ${currentLevel === null ? "active" : ""}`}
        >
          All
        </Link>
        {hskLevels.map((level) => (
          <Link
            key={level}
            to={`/words?level=${level}`}
            className={`level-tab ${currentLevel === level ? "active" : ""}`}
          >
            HSK {HSK_LEVEL_LABELS[level] ?? level}
          </Link>
        ))}
      </nav>

      {currentLevel !== null && (
        <div className="level-actions">
          <span>
            {levelTrackedCount} / {wordsWithTracking.length} tracked in HSK {HSK_LEVEL_LABELS[currentLevel] ?? currentLevel}
          </span>
          <button type="button" className="bulk-btn" onClick={handleBulkToggle}>
            {allLevelTracked ? "Untrack All" : "Track All"} HSK {HSK_LEVEL_LABELS[currentLevel] ?? currentLevel}
          </button>
        </div>
      )}

      <FrequencyCoverage stats={frequencyStats} coverageCurve={coverageCurve} initialView={freqView} isHsk7={currentLevel === 7} />

      <WordList words={wordsWithTracking} prefs={wordListPrefs} onToggle={toggleWord} />
    </div>
  );
}
