import type { WordWithTracking } from "~/lib/types";
import { WordListItem } from "./word-list-item";

export function WordList({ words }: { words: WordWithTracking[] }) {
  return (
    <div className="word-list-container">
      <table className="word-table">
        <thead>
          <tr>
            <th className="col-track">Track</th>
            <th className="col-character">Character</th>
            <th className="col-pinyin">Pinyin</th>
            <th className="col-meaning">Meaning</th>
            <th className="col-level">HSK</th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <WordListItem key={word.id} word={word} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
