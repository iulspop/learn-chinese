import { useState, useCallback, useRef } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/export";
import { getWordsWithTracking, getWordIndex } from "~/lib/words.server";
import { Toast, type ToastData } from "~/components/toast";
import type { WordWithTracking, WordIndexEntry } from "~/lib/types";

function AudioButton({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const handleClick = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="rc-audio-btn"
        onClick={handleClick}
        aria-label="Play audio"
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
    </>
  );
}

interface CardTemplate {
  id: string;
  name: string;
  front: (w: WordWithTracking, idx?: WordIndexEntry) => React.ReactNode;
  back: (w: WordWithTracking, idx?: WordIndexEntry) => React.ReactNode;
}

function SentenceBlockFront({ idx }: { idx?: WordIndexEntry }) {
  if (idx?.sentence) {
    return (
      <>
        <div className="rc-sentence">{idx.sentence}</div>
        {idx.sentencePinyin && (
          <div className="rc-pinyin-sen rc-whover-sen">{idx.sentencePinyin}</div>
        )}
      </>
    );
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
          {(idx.audio || idx.sentenceAudio) && (
            <div className="rc-audio-row">
              {idx.audio && <AudioButton src={`/media/${idx.audio}`} />}
              {idx.sentenceAudio && (
                <AudioButton src={`/media/${idx.sentenceAudio}`} />
              )}
            </div>
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
    id: "pinyin-meaning",
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
    id: "character-meaning",
    name: "Character → Meaning",
    front: (w, idx) => (
      <>
        <div
          className="rc-hanzi rc-whover"
          style={{ "--pinyin": `'${idx?.pinyin || w.pinyin}'` } as React.CSSProperties}
        >
          {w.character}
        </div>
        <div className="rc-pinyin"><br /></div>
        <div className="rc-english"><br /></div>
        <div className="rc-description"><br /></div>
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

  const sampleWord =
    trackedWords.find((w) => wordIndex[w.character]?.sentence) ??
    trackedWords[0];
  const sampleIndex = sampleWord ? wordIndex[sampleWord.character] : undefined;

  return { trackedWords, sampleWord, sampleIndex };
}

export default function ExportRoute() {
  const { trackedWords, sampleWord, sampleIndex } =
    useLoaderData<typeof loader>();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [enabledTemplates, setEnabledTemplates] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(TEMPLATES.map((t) => [t.id, true]))
  );

  const selectedCount = Object.values(enabledTemplates).filter(Boolean).length;
  const totalCards = trackedWords.length * selectedCount;

  const toggleTemplate = (id: string) => {
    setEnabledTemplates((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // Prevent deselecting all
      if (Object.values(next).every((v) => !v)) return prev;
      return next;
    });
  };

  const handleExport = useCallback(async () => {
    setToast({ type: "pending", message: "Exporting Anki deck..." });
    try {
      const selected = Object.entries(enabledTemplates)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch("http://localhost:5001/export-anki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: selected }),
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
  }, [enabledTemplates]);

  const activeTemplates = TEMPLATES.filter((t) => enabledTemplates[t.id]);

  return (
    <div className="export-page">
      <header className="export-header">
        <a href="/words" className="back-link">
          &larr; Back to vocabulary
        </a>
        <h1>Export to Anki</h1>
      </header>

      {trackedWords.length === 0 ? (
        <div className="export-empty">
          <p>No words tracked yet. Go back and track some words first.</p>
        </div>
      ) : (
        <>
          <div className="export-config">
            <h2 className="export-config-title">Card Types</h2>
            <div className="template-toggles">
              {TEMPLATES.map((template) => (
                <label key={template.id} className="template-toggle">
                  <input
                    type="checkbox"
                    checked={enabledTemplates[template.id]}
                    onChange={() => toggleTemplate(template.id)}
                  />
                  {template.name}
                </label>
              ))}
            </div>
          </div>

          <div className="export-summary">
            <p>
              <strong>{trackedWords.length}</strong> words &middot;{" "}
              {selectedCount} card {selectedCount === 1 ? "type" : "types"}{" "}
              &middot; <strong>{totalCards}</strong> total cards
            </p>
          </div>

          <div className="card-templates">
            {activeTemplates.map((template) => (
              <div key={template.id} className="card-template-section">
                <h2 className="template-name">{template.name}</h2>
                <div className="card-preview-row">
                  <div className="card-preview">
                    <div className="card-label">Front</div>
                    <div className="anki-card">
                      {template.front(sampleWord, sampleIndex)}
                    </div>
                  </div>
                  <div className="card-preview">
                    <div className="card-label">Back</div>
                    <div className="anki-card">
                      {template.back(sampleWord, sampleIndex)}
                    </div>
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
                : "Download .apkg"}
            </button>
          </div>
        </>
      )}

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
