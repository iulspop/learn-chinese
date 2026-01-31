import { useMemo } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/words";
import { getWords, getAllWords } from "~/lib/words.server";
import { WordList } from "~/components/word-list";
import { FrequencyCoverage } from "~/components/frequency-coverage";
import { useTrackedWords } from "~/hooks/use-tracked-words";
import { computeFrequencyStats, computeCoverageCurve } from "~/lib/stats";
import type { WordWithTracking } from "~/lib/types";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
const HSK_LEVEL_LABELS: Record<number, string> = { 7: "7-9" };

function parseColumnVisibility(cookieHeader: string | null): Record<string, boolean> {
  if (!cookieHeader) return {};
  const match = cookieHeader.match(/(?:^|;\s*)col-visibility=([^;]*)/);
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return {};
  }
}

function parseFreqView(cookieHeader: string | null): "bars" | "coverage" {
  if (!cookieHeader) return "bars";
  const match = cookieHeader.match(/(?:^|;\s*)freq-view=([^;]*)/);
  if (!match) return "bars";
  return match[1] === "coverage" ? "coverage" : "bars";
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const levelParam = url.searchParams.get("level");
  const level = levelParam ? parseInt(levelParam, 10) : undefined;

  const words = getWords(level);
  const allWords = getAllWords();
  const cookieHeader = request.headers.get("cookie");
  const columnVisibility = parseColumnVisibility(cookieHeader);
  const freqView = parseFreqView(cookieHeader);

  return { words, allWords, currentLevel: level ?? null, freqView, columnVisibility };
}

export default function WordsRoute() {
  const { words, allWords, currentLevel, freqView, columnVisibility } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const { trackedWords, toggleWord, trackAll, untrackAll } = useTrackedWords();

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

  return (
    <div className="words-page">
      <header className="words-header">
        <h1>HSK Vocabulary</h1>
        <div className="header-info">
          <span className="tracked-badge">{trackedCount} words tracked</span>
          <a href="/export" className="export-btn">
            Export to Anki
          </a>
        </div>
      </header>

      <nav className="level-tabs">
        <a
          href="/words"
          className={`level-tab ${currentLevel === null ? "active" : ""}`}
        >
          All
        </a>
        {HSK_LEVELS.map((level) => (
          <a
            key={level}
            href={`/words?level=${level}`}
            className={`level-tab ${currentLevel === level ? "active" : ""}`}
          >
            HSK {HSK_LEVEL_LABELS[level] ?? level}
          </a>
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

      <WordList words={wordsWithTracking} initialColumnVisibility={columnVisibility} onToggle={toggleWord} />
    </div>
  );
}
