import type { WordWithTracking } from "~/lib/types";

export function TrackCell({ word, onToggle }: { word: WordWithTracking; onToggle: (wordId: string) => void }) {
  return (
    <button
      type="button"
      className={`track-btn ${word.isTracked ? "tracked" : ""}`}
      aria-label={
        word.isTracked ? `Untrack ${word.character}` : `Track ${word.character}`
      }
      onClick={() => onToggle(word.id)}
    >
      {word.isTracked ? "✓" : "○"}
    </button>
  );
}
