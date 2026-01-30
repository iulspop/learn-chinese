import { useState, useCallback } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/export";
import { getWordsWithTracking, getWordIndex } from "~/lib/words.server";
import { Toast, type ToastData } from "~/components/toast";
import type { WordWithTracking, WordIndexEntry } from "~/lib/types";

interface CardTemplate {
  name: string;
  front: (w: WordWithTracking, idx?: WordIndexEntry) => React.ReactNode;
  back: (w: WordWithTracking, idx?: WordIndexEntry) => React.ReactNode;
}

function SentenceBlockFront({ idx }: { idx?: WordIndexEntry }) {
  if (idx?.sentence) {
    return <div className="rc-sentence">{idx.sentence}</div>;
  }
  return <div className="rc-stub">(example sentence coming soon)</div>;
}

function SentenceBlockBack({ idx }: { idx?: WordIndexEntry }) {
  return (
    <>
      {idx?.sentence ? (
        <>
          <div className="rc-sentence">{idx.sentence}</div>
          {idx.sentencePinyin && (
            <div className="rc-pinyin-sen">{idx.sentencePinyin}</div>
          )}
          {idx.sentenceMeaning && (
            <div className="rc-meaning-sen">{idx.sentenceMeaning}</div>
          )}
          {idx.sentenceImage && (
            <div className="rc-image">
              <img src={`/media/${idx.sentenceImage}`} alt="" />
            </div>
          )}
        </>
      ) : (
        <div className="rc-stub">(example sentence coming soon)</div>
      )}
    </>
  );
}

const TEMPLATES: CardTemplate[] = [
  {
    name: "Pinyin → Meaning",
    front: (w, idx) => (
      <>
        <div className="rc-pinyin">{idx?.pinyin || w.pinyin}</div>
        {idx?.partOfSpeech && (
          <div className="rc-description">{idx.partOfSpeech}</div>
        )}
        <hr />
        <SentenceBlockFront idx={idx} />
      </>
    ),
    back: (w, idx) => (
      <>
        <div className="rc-hanzi">{w.character}</div>
        <div className="rc-pinyin">{idx?.pinyin || w.pinyin}</div>
        <div className="rc-english">{idx?.meaning || w.meaning}</div>
        {idx?.partOfSpeech && (
          <div className="rc-description">{idx.partOfSpeech}</div>
        )}
        <hr />
        <SentenceBlockBack idx={idx} />
      </>
    ),
  },
  {
    name: "Character → Meaning",
    front: (w, idx) => (
      <>
        <div className="rc-hanzi">{w.character}</div>
        <hr />
        <SentenceBlockFront idx={idx} />
      </>
    ),
    back: (w, idx) => (
      <>
        <div className="rc-hanzi">{w.character}</div>
        <div className="rc-pinyin">{idx?.pinyin || w.pinyin}</div>
        <div className="rc-english">{idx?.meaning || w.meaning}</div>
        {idx?.partOfSpeech && (
          <div className="rc-description">{idx.partOfSpeech}</div>
        )}
        <hr />
        <SentenceBlockBack idx={idx} />
      </>
    ),
  },
];

export function loader() {
  const allWords = getWordsWithTracking();
  const trackedWords = allWords.filter((w) => w.isTracked);
  const wordIndex = getWordIndex();

  // Pick a sample word that has index data for a richer preview
  const sampleWord =
    trackedWords.find((w) => wordIndex[w.character]?.sentence) ??
    trackedWords[0];
  const sampleIndex = sampleWord ? wordIndex[sampleWord.character] : undefined;

  return {
    trackedWords,
    sampleWord,
    sampleIndex,
    cardsPerWord: 2,
    totalCards: trackedWords.length * 2,
  };
}

export default function ExportRoute() {
  const { trackedWords, sampleWord, sampleIndex, cardsPerWord, totalCards } =
    useLoaderData<typeof loader>();
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
          {cardsPerWord} cards per word &middot;{" "}
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
            {TEMPLATES.map((template) => (
              <div key={template.name} className="card-template-section">
                <h2 className="template-name">{template.name}</h2>
                <div className="card-preview-row">
                  <div className="card-preview">
                    <div className="card-label">Front</div>
                    <div className="anki-card">{template.front(sampleWord, sampleIndex)}</div>
                  </div>
                  <div className="card-preview">
                    <div className="card-label">Back</div>
                    <div className="anki-card">{template.back(sampleWord, sampleIndex)}</div>
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
