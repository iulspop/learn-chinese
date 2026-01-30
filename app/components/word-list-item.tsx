import { useFetcher } from "react-router";
import type { WordWithTracking } from "~/lib/types";

export function WordListItem({ word }: { word: WordWithTracking }) {
  const fetcher = useFetcher();

  const isToggling = fetcher.state !== "idle";
  const optimisticTracked = isToggling ? !word.isTracked : word.isTracked;

  return (
    <tr className={optimisticTracked ? "tracked" : ""}>
      <td className="col-track">
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
      </td>
      <td className="col-character">{word.character}</td>
      <td className="col-pinyin">{word.pinyin}</td>
      <td className="col-meaning">{word.meaning}</td>
      <td className="col-level">{word.hskLevel}</td>
    </tr>
  );
}
