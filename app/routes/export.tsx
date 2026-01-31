import { useState, useCallback, useRef, useMemo } from "react";
import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/export";
import { getWords, getWordIndex, type HskVersion } from "~/lib/words.server";
import { useTrackedWords } from "~/hooks/use-tracked-words";
import { Toast, type ToastData } from "~/components/toast";
import { Checkbox } from "@base-ui/react/checkbox";
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
          <div className="rc-pinyin-sen rc-whover-sen">
            {idx.sentencePinyin.includes("Sandhi:") ? (
              <>
                {idx.sentencePinyin.split("Sandhi:")[0].trim()}
                <br />
                Sandhi: {idx.sentencePinyin.split("Sandhi:")[1].trim()}
              </>
            ) : (
              idx.sentencePinyin
            )}
          </div>
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
            <div className="rc-pinyin-sen">
              {idx.sentencePinyin.includes("Sandhi:") ? (
                <>
                  {idx.sentencePinyin.split("Sandhi:")[0].trim()}
                  <br />
                  Sandhi: {idx.sentencePinyin.split("Sandhi:")[1].trim()}
                </>
              ) : (
                idx.sentencePinyin
              )}
            </div>
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
  {
    id: "meaning-character",
    name: "Meaning → Character",
    front: (w, idx) => (
      <>
        <div className="rc-english">{idx?.meaning || w.meaning}</div>
        {idx?.partOfSpeech && (
          <div className="rc-description">{idx.partOfSpeech}</div>
        )}
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

function parseCookieRaw(cookieHeader: string | null, key: string, fallback: string): string {
  if (!cookieHeader) return fallback;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : fallback;
}

export function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("cookie");
  const version = parseCookieRaw(cookieHeader, "hsk-version", "3.0") as HskVersion;
  const allWords = getWords(undefined, version);
  const wordIndex = getWordIndex();
  return { allWords, wordIndex };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const serverData = await serverLoader();
  const raw = localStorage.getItem("tracked-words");
  const trackedIds: string[] = raw ? JSON.parse(raw) : [];
  return { ...serverData, trackedIds };
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="export-page">
      <header className="export-header">
        <Link to="/words" className="back-link">&larr; Back to vocabulary</Link>
        <h1>Export to Anki</h1>
      </header>
    </div>
  );
}

export default function ExportRoute() {
  const { allWords, wordIndex } = useLoaderData<typeof clientLoader>();
  const { trackedWords } = useTrackedWords();

  const trackedWordsList: WordWithTracking[] = useMemo(
    () => allWords
      .filter((w) => trackedWords.has(w.id))
      .map((w) => ({ ...w, isTracked: true })),
    [allWords, trackedWords],
  );

  const sampleWord = trackedWordsList.find((w) => wordIndex[w.character]?.sentence) ?? trackedWordsList[0];
  const sampleIndex = sampleWord ? wordIndex[sampleWord.character] : undefined;

  const [toast, setToast] = useState<ToastData | null>(null);
  const [enabledTemplates, setEnabledTemplates] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(TEMPLATES.map((t) => [t.id, true]))
  );

  const selectedCount = Object.values(enabledTemplates).filter(Boolean).length;
  const totalCards = trackedWordsList.length * selectedCount;

  const toggleTemplate = (id: string) => {
    setEnabledTemplates((prev) => {
      const next = { ...prev, [id]: !prev[id] };
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
        body: JSON.stringify({ templates: selected, trackedWords: [...trackedWords] }),
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
  }, [enabledTemplates, trackedWords]);

  const activeTemplates = TEMPLATES.filter((t) => enabledTemplates[t.id]);

  return (
    <div className="export-page">
      <header className="export-header">
        <Link to="/words" className="back-link">
          &larr; Back to vocabulary
        </Link>
        <h1>Export to Anki</h1>
      </header>

      {trackedWordsList.length === 0 ? (
        <div className="export-empty">
          <p>No words tracked yet. Go back and track some words first.</p>
        </div>
      ) : (
        <>
          <div className="export-config">
            <h2 className="export-config-title">Card Types</h2>
            <div className="template-toggles">
              {TEMPLATES.map((template) => (
                <label key={template.id} className="template-toggle" onClick={() => toggleTemplate(template.id)}>
                  <Checkbox.Root
                    className="template-checkbox"
                    checked={enabledTemplates[template.id]}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggleTemplate(template.id)}
                  >
                    <Checkbox.Indicator className="template-checkbox-indicator">
                      &#10003;
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  {template.name}
                </label>
              ))}
            </div>
          </div>

          <div className="export-summary">
            <p>
              <strong>{trackedWordsList.length}</strong> words &middot;{" "}
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
                      {sampleWord && template.front(sampleWord, sampleIndex)}
                    </div>
                  </div>
                  <div className="card-preview">
                    <div className="card-label">Back</div>
                    <div className="anki-card">
                      {sampleWord && template.back(sampleWord, sampleIndex)}
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
