import { useState, useCallback } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/export";
import { getWordsWithTracking } from "~/lib/words.server";
import { Toast, type ToastData } from "~/components/toast";
import type { WordWithTracking } from "~/lib/types";

interface CardTemplate {
  name: string;
  front: (w: WordWithTracking) => React.ReactNode;
  back: (w: WordWithTracking) => React.ReactNode;
}

const BEGINNER_TEMPLATES: CardTemplate[] = [
  {
    name: "Pinyin → Meaning",
    front: (w) => (
      <>
        <div className="anki-pinyin">{w.pinyin}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
      </>
    ),
    back: (w) => (
      <>
        <div className="anki-pinyin">{w.pinyin}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
        <hr />
        <div className="anki-meaning">{w.meaning}</div>
        <div className="anki-character">{w.character}</div>
      </>
    ),
  },
  {
    name: "Character → Pronunciation",
    front: (w) => (
      <>
        <div className="anki-character">{w.character}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
      </>
    ),
    back: (w) => (
      <>
        <div className="anki-character">{w.character}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
        <hr />
        <div className="anki-pinyin">{w.pinyin}</div>
        <div className="anki-meaning">{w.meaning}</div>
      </>
    ),
  },
  {
    name: "Character → Meaning",
    front: (w) => (
      <>
        <div className="anki-character">{w.character}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
      </>
    ),
    back: (w) => (
      <>
        <div className="anki-character">{w.character}</div>
        <div className="anki-hsk">HSK {w.hskLevel}</div>
        <hr />
        <div className="anki-meaning">{w.meaning}</div>
        <div className="anki-pinyin">{w.pinyin}</div>
      </>
    ),
  },
];

const ADVANCED_TEMPLATES: CardTemplate[] = [BEGINNER_TEMPLATES[2]];

export function loader() {
  const allWords = getWordsWithTracking();
  const trackedWords = allWords.filter((w) => w.isTracked);
  const isBeginner = trackedWords.length < 200;

  return {
    trackedWords,
    isBeginner,
    mode: isBeginner ? "beginner" : "advanced",
    cardsPerWord: isBeginner ? 3 : 1,
    totalCards: trackedWords.length * (isBeginner ? 3 : 1),
  };
}

export default function ExportRoute() {
  const { trackedWords, isBeginner, mode, cardsPerWord, totalCards } =
    useLoaderData<typeof loader>();
  const [toast, setToast] = useState<ToastData | null>(null);

  const templates = isBeginner ? BEGINNER_TEMPLATES : ADVANCED_TEMPLATES;
  const sampleWord = trackedWords[0];

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
      setToast({
        type: "error",
        message: "Failed to connect to export server",
      });
    }
  }, []);

  return (
    <div className="export-page">
      <header className="export-header">
        <a href="/words" className="back-link">
          &larr; Back to vocabulary
        </a>
        <h1>Export Preview</h1>
      </header>

      <div className="export-summary">
        <p>
          <strong>{trackedWords.length}</strong> words tracked &middot;{" "}
          <strong>{mode}</strong> mode &middot; {cardsPerWord} card
          {cardsPerWord > 1 ? "s" : ""} per word &middot;{" "}
          <strong>{totalCards}</strong> total cards
        </p>
      </div>

      {trackedWords.length === 0 ? (
        <div className="export-empty">
          <p>No words tracked yet. Go back and track some words first.</p>
        </div>
      ) : (
        <>
          <div className="card-templates">
            {templates.map((template) => (
              <div key={template.name} className="card-template-section">
                <h2 className="template-name">{template.name}</h2>
                <div className="card-preview-row">
                  <div className="card-preview">
                    <div className="card-label">Front</div>
                    <div className="anki-card">{template.front(sampleWord)}</div>
                  </div>
                  <div className="card-preview">
                    <div className="card-label">Back</div>
                    <div className="anki-card">{template.back(sampleWord)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="export-action">
            <button
              type="button"
              className="export-confirm-btn"
              onClick={handleExport}
              disabled={toast?.type === "pending"}
            >
              {toast?.type === "pending"
                ? "Exporting..."
                : "Confirm & Download"}
            </button>
          </div>
        </>
      )}

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
