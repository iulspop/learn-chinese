import { useLoaderData, useSearchParams, Form } from "react-router";
import type { Route } from "./+types/words";
import {
  getWordsWithTracking,
  toggleWord,
  trackAllInLevel,
  untrackAllInLevel,
  getTrackedWords,
  getFrequencyStats,
  getCoverageCurve,
} from "~/lib/words.server";
import { WordList } from "~/components/word-list";
import { FrequencyCoverage } from "~/components/frequency-coverage";

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

  const words = getWordsWithTracking(level);
  const trackedCount = getTrackedWords().tracked.length;
  const frequencyStats = getFrequencyStats(level);
  const coverageCurve = getCoverageCurve(level);
  const cookieHeader = request.headers.get("cookie");
  const columnVisibility = parseColumnVisibility(cookieHeader);
  const freqView = parseFreqView(cookieHeader);

  return { words, trackedCount, currentLevel: level ?? null, frequencyStats, coverageCurve, freqView, columnVisibility };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle") {
    const wordId = formData.get("wordId") as string;
    toggleWord(wordId);
  } else if (intent === "trackAllLevel") {
    const level = parseInt(formData.get("level") as string, 10);
    trackAllInLevel(level);
  } else if (intent === "untrackAllLevel") {
    const level = parseInt(formData.get("level") as string, 10);
    untrackAllInLevel(level);
  }

  return null;
}

export default function WordsRoute() {
  const { words, trackedCount, currentLevel, frequencyStats, coverageCurve, freqView, columnVisibility } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const levelTrackedCount = words.filter((w) => w.isTracked).length;
  const allLevelTracked = words.length > 0 && levelTrackedCount === words.length;

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
            {levelTrackedCount} / {words.length} tracked in HSK {HSK_LEVEL_LABELS[currentLevel] ?? currentLevel}
          </span>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value={allLevelTracked ? "untrackAllLevel" : "trackAllLevel"}
            />
            <input type="hidden" name="level" value={currentLevel} />
            <button type="submit" className="bulk-btn">
              {allLevelTracked ? "Untrack All" : "Track All"} HSK {HSK_LEVEL_LABELS[currentLevel] ?? currentLevel}
            </button>
          </Form>
        </div>
      )}

      <FrequencyCoverage stats={frequencyStats} coverageCurve={coverageCurve} initialView={freqView} isHsk7={currentLevel === 7} />

      <WordList words={words} initialColumnVisibility={columnVisibility} />
    </div>
  );
}
