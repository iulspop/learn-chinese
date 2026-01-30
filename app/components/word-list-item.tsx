import { useFetcher } from "react-router";
import type { WordWithTracking } from "~/lib/types";

export function TrackCell({ word }: { word: WordWithTracking }) {
  const fetcher = useFetcher();

  const isToggling = fetcher.state !== "idle";
  const optimisticTracked = isToggling ? !word.isTracked : word.isTracked;

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle" />
      <input type="hidden" name="wordId" value={word.id} />
      <button
        type="submit"
        className={`track-btn ${optimisticTracked ? "tracked" : ""}`}
        aria-label={
          optimisticTracked ? `Untrack ${word.character}` : `Track ${word.character}`
        }
      >
        {optimisticTracked ? "✓" : "○"}
      </button>
    </fetcher.Form>
  );
}
