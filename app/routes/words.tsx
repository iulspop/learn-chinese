import { useState, useCallback } from "react";
import { useLoaderData, useSearchParams, Form } from "react-router";
import type { Route } from "./+types/words";
import {
  getWordsWithTracking,
  toggleWord,
  trackAllInLevel,
  untrackAllInLevel,
  getTrackedWords,
  getFrequencyStats,
} from "~/lib/words.server";
import { WordList } from "~/components/word-list";
import { FrequencyCoverage } from "~/components/frequency-coverage";
import { Toast, type ToastData } from "~/components/toast";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
const HSK_LEVEL_LABELS: Record<number, string> = { 7: "7-9" };

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const levelParam = url.searchParams.get("level");
  const level = levelParam ? parseInt(levelParam, 10) : undefined;

  const words = getWordsWithTracking(level);
  const trackedCount = getTrackedWords().tracked.length;
  const frequencyStats = getFrequencyStats(level);

  return { words, trackedCount, currentLevel: level ?? null, frequencyStats };
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
  const { words, trackedCount, currentLevel, frequencyStats } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState<ToastData | null>(null);

  const handleExport = useCallback(async () => {
    setToast({ type: "pending", message: "Exporting Anki deck..." });
    try {
      const res = await fetch("http://localhost:5001/export-anki", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "Export failed" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hsk-vocabulary.apkg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast({ type: "success", message: "Anki deck downloaded!" });
    } catch {
      setToast({ type: "error", message: "Failed to connect to export server" });
    }
  }, []);

  const levelTrackedCount = words.filter((w) => w.isTracked).length;
  const allLevelTracked = words.length > 0 && levelTrackedCount === words.length;

  return (
    <div className="words-page">
      <header className="words-header">
        <h1>HSK Vocabulary</h1>
        <div className="header-info">
          <span className="tracked-badge">{trackedCount} words tracked</span>
          <button
            type="button"
            className="export-btn"
            onClick={handleExport}
            disabled={toast?.type === "pending"}
          >
            Export to Anki
          </button>
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

      <FrequencyCoverage stats={frequencyStats} isHsk7={currentLevel === 7} />

      <WordList words={words} />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
