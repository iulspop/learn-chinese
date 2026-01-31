import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Dialog } from "@base-ui/react/dialog";
import type { HskWordWithDeck } from "~/lib/types";

export function AddWordDialog({ existingWords }: { existingWords: HskWordWithDeck[] }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [simplified, setSimplified] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmitting = fetcher.state !== "idle";

  const existingIds = useMemo(
    () => new Set(existingWords.map((w) => w.id)),
    [existingWords],
  );

  const simplifiedError = simplified.trim() && existingIds.has(simplified.trim())
    ? `"${simplified.trim()}" already exists in the word list`
    : null;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        setOpen(false);
      } else {
        setServerError(fetcher.data.error ?? "Failed to add word");
      }
    }
  }, [fetcher.data, fetcher.state]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setServerError(null);
      setSimplified("");
      formRef.current?.reset();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger className="add-word-btn">+ Add Word</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup">
          <Dialog.Title className="dialog-title">Add Custom Word</Dialog.Title>
          <fetcher.Form ref={formRef} method="post" action="/words" className="add-word-form" onChange={() => setServerError(null)}>
            <input type="hidden" name="intent" value="add-word" />
            <div className={`add-word-field ${simplifiedError ? "field-invalid" : ""}`}>
              <label className="add-word-label" htmlFor="add-simplified">Simplified</label>
              <input
                id="add-simplified"
                name="simplified"
                required
                placeholder="e.g. 咖啡"
                className="add-word-input"
                value={simplified}
                onChange={(e) => setSimplified(e.target.value)}
              />
              {simplifiedError && <p className="add-word-field-error">{simplifiedError}</p>}
            </div>
            <div className="add-word-field">
              <label className="add-word-label" htmlFor="add-pinyin">Pinyin</label>
              <input
                id="add-pinyin"
                name="pinyin"
                required
                placeholder="e.g. kāfēi"
                className="add-word-input"
              />
            </div>
            <div className="add-word-field">
              <label className="add-word-label" htmlFor="add-meaning">Meaning</label>
              <input
                id="add-meaning"
                name="meaning"
                required
                placeholder="e.g. coffee"
                className="add-word-input"
              />
            </div>
            {serverError && <p className="add-word-error">{serverError}</p>}
            <div className="add-word-actions">
              <Dialog.Close className="add-word-cancel">Cancel</Dialog.Close>
              <button type="submit" className="add-word-submit" disabled={isSubmitting || !!simplifiedError}>
                {isSubmitting ? "Adding..." : "Add Word"}
              </button>
            </div>
          </fetcher.Form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
