import {
  deriveSession,
  lineNumberOf,
  makeMovementMatcher,
  splitLines,
  suggestSpans,
  type ImportCheck,
  type ImportIssue,
  type CatalogMovement,
  type ImportDocument,
  type ImportSummary,
  type MovementId,
  type SpanId,
  type WorkoutId,
} from "@chalk/contracts";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@chalk/ui/components/alert-dialog.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Highlighter, RotateCcw, Save } from "lucide-react";
import { useEffect, useEffectEvent, useReducer, useState } from "react";

import {
  editorReducer,
  initialEditorState,
  linkedIds,
  toDocument,
  type TagChoice,
} from "../../lib/importEditor.ts";
import { SAVE_REACTIVITY_KEYS, saveImportAtom } from "../../state/imports.ts";
import { AnnotatedText, type TextRange } from "./AnnotatedText.tsx";
import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { FieldBox } from "../FieldBox.tsx";
import { countItems, SessionProtocol } from "./SessionProtocol.tsx";
import { SpanInspector } from "./SpanInspector.tsx";
import { KeySwatch, TAG_ACTIONS, TagBar } from "./TagBar.tsx";

type SaveStatus =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "conflict"; readonly existing: ImportSummary };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Fresh suggestion ids: unique within the document, distinct from the editor's "e" ids. */
export const suggestDocument = (
  text: string,
  catalog: ReadonlyArray<CatalogMovement>,
): ImportDocument => {
  let next = 0;
  return { text, spans: suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`) };
};

export function ImportWorkbench({
  initial,
  replace,
  catalog,
  onSaved,
  onDiscard,
}: {
  readonly initial: ImportDocument;
  /** The stored import this editor rewrites, when re-opened. */
  readonly replace: WorkoutId | undefined;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly onSaved: (summary: ImportSummary) => void;
  readonly onDiscard: () => void;
}) {
  const [state, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const [selection, setSelection] = useState<TextRange | undefined>();
  const [hovered, setHovered] = useState<SpanId | undefined>();
  const [status, setStatus] = useState<SaveStatus>({ type: "idle" });
  const saveImport = useAtomSet(saveImportAtom, { mode: "promiseExit" });

  const matcher = makeMovementMatcher(catalog);
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const nameOf = (id: MovementId) => names.get(id);
  const document = toDocument(state);
  const session = deriveSession(document, nameOf);
  const errors = session.issues.filter((issue) => issue.severity === "error");
  const selected = state.spans.find((span) => span.id === state.selectedId);
  const linked = linkedIds(state.spans, hovered ?? state.selectedId);
  const hasDateSpan = state.spans.some((span) => span._tag === "date");
  const lines = splitLines(state.text);
  const lineOf = (id: SpanId) => {
    const span = state.spans.find((candidate) => candidate.id === id);
    return span === undefined ? undefined : lineNumberOf(lines, span.start);
  };
  const flaggedLines = new Set(
    errors.flatMap((issue) => {
      const line = issue.spanId === undefined ? undefined : lineOf(issue.spanId);
      return line === undefined ? [] : [line];
    }),
  );
  const selectedText = selection
    ? state.text.slice(selection.start, selection.end).trim()
    : undefined;

  // Pending text selection beats the selected mark: the next key press tags the selection.
  const aside = selectedText !== undefined ? "tag" : selected ? "mark" : "keys";

  function tag(choice: TagChoice) {
    if (!selection) return;
    const resolved: TagChoice =
      choice.tag === "movement"
        ? {
            tag: "movement",
            movementId: matcher.lookup(state.text.slice(selection.start, selection.end)),
          }
        : choice;
    dispatch({ type: "tag", start: selection.start, end: selection.end, choice: resolved });
    setSelection(undefined);
    window.getSelection()?.removeAllRanges();
  }

  function handleClickSpan(id: SpanId) {
    setSelection(undefined);
    dispatch(state.picking ? { type: "target", id } : { type: "select", id });
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape") {
      if (state.picking) dispatch({ type: "pick", mode: undefined });
      else dispatch({ type: "select", id: undefined });
      setSelection(undefined);
      return;
    }
    if (selection) {
      const action = TAG_ACTIONS.find((candidate) => candidate.key === event.key.toLowerCase());
      if (action) {
        event.preventDefault();
        tag(action.choice);
      }
      return;
    }
    if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "remove", id: selected.id });
    } else if (event.key.toLowerCase() === "a") {
      const mode = selected._tag === "movement" ? "alternative" : "attach";
      if (selected._tag === "movement" || selected._tag === "quantity" || selected._tag === "score")
        dispatch({ type: "pick", mode: state.picking ? undefined : mode });
    }
  });

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- window keydown listener for the editor's shortcuts while it is mounted
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  async function save(replacing: WorkoutId | undefined) {
    setStatus({ type: "saving" });
    const exit = await saveImport({
      payload: { document, ...(replacing === undefined ? {} : { replace: replacing }) },
      reactivityKeys: SAVE_REACTIVITY_KEYS,
    });
    if (Exit.isSuccess(exit)) {
      setStatus({ type: "idle" });
      onSaved(exit.value);
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && failure.value._tag === "ImportConflictError") {
      setStatus({ type: "conflict", existing: failure.value.existing });
    } else if (Option.isSome(failure) && failure.value._tag === "ImportInvalidError") {
      setStatus({ type: "error", message: failure.value.problems.join(" ") });
    } else {
      setStatus({
        type: "error",
        message: "Could not save the session. Is the admin server running?",
      });
    }
  }

  return (
    <div data-workbench className="flex flex-col">
      <div className="flex flex-wrap items-stretch border-b bg-card">
        <div className="flex flex-col justify-center gap-1 border-r px-5 py-2.5">
          <h1 className="protocol-title text-3xl">{session.name}</h1>
          <p className="text-xs text-muted-foreground">
            {replace ? "Editing a saved import" : "New import, not saved yet"}
          </p>
        </div>
        <dl className="flex flex-wrap divide-x border-r">
          <FieldBox label="Date" wide={!hasDateSpan}>
            {hasDateSpan ? (
              session.performedOn
            ) : (
              <Input
                type="date"
                aria-label="Performed on"
                value={session.performedOn ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "setDate",
                    date: event.target.value === "" ? undefined : event.target.value,
                  })
                }
              />
            )}
          </FieldBox>
          <FieldBox label="Kind">{WORKOUT_KIND_LABELS[session.kind]}</FieldBox>
          <FieldBox label="Parts">{session.parts.length}</FieldBox>
          <FieldBox label="Movements">
            {countItems(session.parts.flatMap((part) => part.blocks.flatMap((b) => b.items)))}
          </FieldBox>
          <FieldBox label="Lift sets">{session.liftSets.length}</FieldBox>
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <RefereeLamps issues={session.issues} />
          <div className="flex gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" aria-label="Re-suggest marks" title="Re-suggest" />}
              >
                <Highlighter />
                <span className="hidden xl:inline">Re-suggest</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Replace all marks?</AlertDialogTitle>
                <AlertDialogDescription>
                  Suggestions run again with the current catalog, including aliases you just taught
                  it. Your manual edits in this session are lost.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
                  <AlertDialogClose
                    render={<Button />}
                    onClick={() =>
                      dispatch({
                        type: "replaceAll",
                        spans: suggestDocument(state.text, catalog).spans,
                      })
                    }
                  >
                    Replace marks
                  </AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              aria-label={replace ? "Close" : "Start over"}
              title={replace ? "Close" : "Start over"}
              onClick={onDiscard}
            >
              <RotateCcw />
              <span className="hidden xl:inline">{replace ? "Close" : "Start over"}</span>
            </Button>
            <Button
              disabled={errors.length > 0 || status.type === "saving"}
              onClick={() => void save(replace)}
              title={errors.length > 0 ? "Fix the issues marked in red first" : undefined}
            >
              <Save />
              {status.type === "saving" ? "Saving..." : replace ? "Save changes" : "Save session"}
            </Button>
          </div>
        </div>
      </div>

      {status.type === "error" ? (
        <p role="alert" className="border-b bg-card px-6 py-2 text-sm text-destructive">
          {status.message}
        </p>
      ) : null}

      <AlertDialog
        open={status.type === "conflict"}
        onOpenChange={(open) => (open ? undefined : setStatus({ type: "idle" }))}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Already imported</AlertDialogTitle>
          <AlertDialogDescription>
            {status.type === "conflict"
              ? `${status.existing.name} on ${status.existing.performedOn} is already imported with ${status.existing.itemCount} movements and ${status.existing.liftSetCount} lift sets. Replace it with this version?`
              : ""}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Keep the old one
            </AlertDialogClose>
            <AlertDialogClose
              render={<Button variant="destructive" />}
              onClick={() =>
                status.type === "conflict" ? void save(status.existing.workoutId) : undefined
              }
            >
              Replace it
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,18rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,22rem)]">
        <section aria-label="Source text" className="flex min-h-0 flex-col border-b lg:border-r">
          <PaneHeader title="Source" meta={`${lines.length} lines, ${state.spans.length} marks`} />
          <TagBar selectedText={selectedText} onTag={tag} />
          <div className="min-h-0 flex-1 overflow-auto bg-card">
            <AnnotatedText
              text={state.text}
              spans={state.spans}
              selectedId={state.selectedId}
              linked={linked}
              picking={state.picking}
              onSelectText={setSelection}
              onClickSpan={handleClickSpan}
              flaggedLines={flaggedLines}
            />
          </div>
        </section>
        <section aria-label="Protocol" className="flex min-h-0 flex-col border-b lg:border-r">
          <PaneHeader title="Protocol" meta="What will be saved" />
          <div className="min-h-0 flex-1 overflow-auto">
            <SessionProtocol
              session={session}
              lineOf={lineOf}
              handlers={{
                nameOf,
                selectedId: state.selectedId,
                linked,
                onSelect: handleClickSpan,
                onHover: setHovered,
              }}
            />
          </div>
        </section>
        <aside
          aria-label={aside === "mark" ? "Selected mark" : "Keys"}
          className={
            aside === "mark"
              ? "flex min-h-0 flex-col bg-card"
              : "hidden min-h-0 flex-col bg-card lg:flex"
          }
        >
          <PaneHeader
            title={aside === "mark" ? "Selected mark" : aside === "tag" ? "Tag as" : "Keys"}
            meta={
              aside === "mark"
                ? "Esc to close"
                : aside === "tag"
                  ? `"${selectedText}"`
                  : "Select text, then press a key"
            }
          />
          <div className="min-h-0 flex-1 overflow-auto">
            {aside === "mark" && selected ? (
              <SpanInspector
                key={selected.id}
                span={selected}
                text={state.text}
                spans={state.spans}
                catalog={catalog}
                picking={state.picking}
                onUpdate={(span) => dispatch({ type: "update", span })}
                onRemove={(id) => dispatch({ type: "remove", id })}
                onPick={(mode) => dispatch({ type: "pick", mode })}
                onMovementPicked={(span, movementId, learned) => {
                  dispatch({ type: "update", span: { ...span, movementId } });
                  if (learned)
                    dispatch({
                      type: "tagPhrase",
                      phrase: state.text.slice(span.start, span.end),
                      movementId,
                    });
                }}
              />
            ) : (
              <KeyReference selectedText={selectedText} onTag={tag} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PaneHeader({ title, meta }: { readonly title: string; readonly meta: string }) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <h2 className="form-label text-foreground">{title}</h2>
      <span className="truncate text-xs text-muted-foreground">{meta}</span>
    </header>
  );
}

const CHECKS: ReadonlyArray<{ readonly check: ImportCheck; readonly label: string }> = [
  { check: "date", label: "Date" },
  { check: "movements", label: "Movements" },
  { check: "numbers", label: "Numbers" },
];

/**
 * Three referee lamps, one per check: white for a good lift, red for a no lift. Saving needs
 * three whites.
 */
function RefereeLamps({ issues }: { readonly issues: ReadonlyArray<ImportIssue> }) {
  const failing = new Set(
    issues.filter((issue) => issue.severity === "error").map((issue) => issue.check),
  );
  const failed = CHECKS.filter(({ check }) => failing.has(check));
  return (
    <div className="flex items-center gap-3" role="status">
      <div
        data-lamps
        role="img"
        aria-label={CHECKS.map(
          ({ check, label }) => `${label} ${failing.has(check) ? "no lift" : "good"}`,
        ).join(", ")}
        className="flex items-center gap-2 px-2.5 pb-1 pt-1.5"
      >
        {CHECKS.map(({ check, label }) => (
          <span key={check} className="grid justify-items-center gap-0.5">
            <span
              data-lamp={failing.has(check) ? "fail" : "good"}
              title={`${label}: ${failing.has(check) ? "needs fixing" : "good"}`}
            />
            <span aria-hidden className="form-label leading-none text-band-muted">
              {label.charAt(0)}
            </span>
          </span>
        ))}
      </div>
      <div className="grid leading-tight">
        <span
          className={
            failed.length === 0
              ? "text-base font-bold uppercase font-stretch-condensed"
              : "text-base font-bold uppercase text-destructive font-stretch-condensed"
          }
        >
          {failed.length === 0 ? "Good lift" : "No lift"}
        </span>
        <span className="text-xs text-muted-foreground">
          {failed.length === 0
            ? "Ready to save"
            : `Check ${failed.map(({ label }) => label.toLowerCase()).join(", ")}`}
        </span>
      </div>
    </div>
  );
}

const STATE_SAMPLES = [
  { label: "Resolved", open: false, selected: false },
  { label: "Needs a decision", open: true, selected: false },
  { label: "Selected", open: false, selected: true },
] as const;

/**
 * The side pane's resting state: every tag key, live as a button while text is selected, then
 * the keys for a selected mark and how marks show their state.
 */
function KeyReference({
  selectedText,
  onTag,
}: {
  readonly selectedText: string | undefined;
  readonly onTag: (choice: TagChoice) => void;
}) {
  return (
    <div className="grid gap-5 p-4">
      <ul
        className={selectedText === undefined ? "-mx-2 grid" : "-mx-2 grid gap-1"}
        aria-label="Tag keys"
      >
        {TAG_ACTIONS.map((action) => (
          <li key={action.label}>
            <button
              type="button"
              disabled={selectedText === undefined}
              aria-keyshortcuts={action.key}
              className={
                selectedText === undefined
                  ? "flex w-full items-center gap-2.5 border border-transparent px-2 py-0.5 text-left text-sm"
                  : "flex w-full cursor-pointer items-center gap-2.5 border border-input bg-background px-2 py-0.5 text-left text-sm font-medium transition-[border-color] duration-150 hover:border-foreground"
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onTag(action.choice)}
            >
              <kbd data-key>{action.key}</kbd>
              <KeySwatch choice={action.choice} />
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-1.5 border-t pt-4">
        <h3 className="form-label text-muted-foreground">On a selected mark</h3>
        <p className="flex items-center gap-2.5 text-sm">
          <kbd data-key>a</kbd>
          Attach numbers to a movement, or link an alternative
        </p>
        <p className="flex items-center gap-2.5 text-sm">
          <kbd data-key>del</kbd>
          Remove the mark
        </p>
        <p className="flex items-center gap-2.5 text-sm">
          <kbd data-key>esc</kbd>
          Cancel or deselect
        </p>
      </div>
      <div className="grid gap-2 border-t pt-4">
        <h3 className="form-label text-muted-foreground">Mark states</h3>
        {STATE_SAMPLES.map((sample) => (
          <p key={sample.label} className="flex items-center gap-3 text-sm">
            <mark
              data-tag="movement"
              data-open={sample.open ? "" : undefined}
              data-selected={sample.selected ? "" : undefined}
              className="font-mono"
            >
              Thruster
            </mark>
            {sample.label}
          </p>
        ))}
      </div>
    </div>
  );
}
