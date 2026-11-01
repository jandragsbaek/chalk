import type { TagChoice } from "../../lib/importEditor.ts";

interface TagAction {
  /** Keyboard shortcut while text is selected. */
  readonly key: string;
  readonly label: string;
  readonly choice: TagChoice;
}

export const TAG_ACTIONS: ReadonlyArray<TagAction> = [
  { key: "m", label: "Movement", choice: { tag: "movement", movementId: undefined } },
  { key: "r", label: "Reps", choice: { tag: "quantity", measure: "reps" } },
  { key: "x", label: "Sets", choice: { tag: "quantity", measure: "sets" } },
  { key: "k", label: "Load kg", choice: { tag: "quantity", measure: "load_kg" } },
  { key: "%", label: "% 1RM", choice: { tag: "quantity", measure: "percent_1rm" } },
  { key: "e", label: "RPE", choice: { tag: "quantity", measure: "rpe" } },
  { key: "t", label: "Time", choice: { tag: "quantity", measure: "seconds" } },
  { key: "d", label: "Distance", choice: { tag: "quantity", measure: "distance_m" } },
  { key: "c", label: "Calories", choice: { tag: "quantity", measure: "calories" } },
  { key: "b", label: "Block", choice: { tag: "block" } },
  { key: "h", label: "Part", choice: { tag: "part" } },
  { key: "w", label: "Benchmark", choice: { tag: "benchmark" } },
  { key: "i", label: "Intent (line)", choice: { tag: "intent" } },
  { key: "/", label: "Comment (line)", choice: { tag: "comment" } },
  { key: "o", label: "Score", choice: { tag: "score" } },
  { key: "n", label: "Notes", choice: { tag: "notes" } },
  { key: "y", label: "Date", choice: { tag: "date" } },
  { key: "#", label: "Session #", choice: { tag: "session" } },
];

/** What a key cap's swatch shows: the tag's copy colour. */
export function KeySwatch({ choice }: { readonly choice: TagChoice }) {
  return (
    <span
      data-key-tag={choice.tag}
      data-measure={choice.tag === "quantity" ? choice.measure : undefined}
      className="inline-flex"
    >
      <span data-key-swatch aria-hidden />
    </span>
  );
}

/**
 * The tag keys, docked above the source text. They are live while text is selected; the same
 * letters work from the keyboard.
 */
export function TagBar({
  selectedText,
  onTag,
}: {
  readonly selectedText: string | undefined;
  readonly onTag: (choice: TagChoice) => void;
}) {
  const disabled = selectedText === undefined;
  return (
    <div
      role="toolbar"
      aria-label="Tag the selected text"
      className="grid gap-2 border-b bg-muted px-3 py-2 lg:hidden"
    >
      <p className="flex min-h-5 items-baseline gap-2 text-sm">
        {disabled ? (
          <span className="text-muted-foreground">
            Select text to tag it, or click a mark to edit it.
          </span>
        ) : (
          <>
            <span className="form-label text-muted-foreground">Tag</span>
            <span className="truncate font-mono font-bold" title={selectedText}>
              {selectedText}
            </span>
            <span className="text-muted-foreground">as</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {TAG_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            aria-keyshortcuts={action.key}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-input bg-card pl-1.5 pr-1 text-xs font-medium transition-[border-color,opacity] duration-150 hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-55 disabled:hover:border-input"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onTag(action.choice)}
          >
            <KeySwatch choice={action.choice} />
            {action.label}
            <kbd data-key>{action.key}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
