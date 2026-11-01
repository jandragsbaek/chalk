import {
  deriveSession,
  levelKey,
  levelName,
  lineNumberOf,
  makeMovementMatcher,
  splitLines,
  suggestSpans,
  trailingWords,
  variationLadder,
  type ImportCheck,
  type ImportIssue,
  type CatalogMovement,
  type DerivedBlock,
  type DerivedItem,
  type DerivedSession,
  type ImportDocument,
  type ImportSummary,
  type MovementId,
  type PlanId,
  type SessionPlan,
  type SpanId,
  type SpanOf,
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
import { LevelBadge } from "@chalk/ui/components/level-ruler.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Highlighter, ListChecks, RotateCcw, Save, Undo2, X } from "lucide-react";
import { useEffect, useEffectEvent, useReducer, useRef, useState, type ReactNode } from "react";

import {
  editorReducer,
  initialEditorState,
  linkedIds,
  toDocument,
  type TagChoice,
} from "../../lib/importEditor.ts";
import { formatKg } from "../../lib/blockLabels.ts";
import { findComplexes } from "../../lib/complexes.ts";
import { gradeSession } from "../../lib/levelGrades.ts";
import { asPlanned, withPlannedLoad } from "../../lib/plan.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import { resultDefaults } from "../../lib/resultDraft.ts";
import { chooseOption, chosenOption, stationOptions } from "../../lib/station.ts";
import { isTyping, localIsoDate } from "../../lib/utils.ts";
import { SAVE_REACTIVITY_KEYS, saveImportAtom } from "../../state/imports.ts";
import { PLANS_REACTIVITY_KEY, savePlanAtom } from "../../state/plans.ts";
import { AnnotatedText, type TextRange } from "./AnnotatedText.tsx";
import { PlaceField } from "../PlaceField.tsx";
import { CoachingField } from "./CoachingField.tsx";
import { DebriefSheet } from "./DebriefSheet.tsx";
import { FieldBox } from "../FieldBox.tsx";
import { SimilarSessions, usePlanEchoes } from "../sessions/SimilarSessions.tsx";
import { SessionProtocol } from "./SessionProtocol.tsx";
import { SessionTypeField } from "./SessionTypeField.tsx";
import { SpanInspector, type ComplexInspection } from "./SpanInspector.tsx";
import { KeySwatch, TAG_ACTIONS, TagBar } from "./TagBar.tsx";

type SaveStatus =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "conflict"; readonly existing: ImportSummary };

/** Fresh suggestion ids: unique within the document, distinct from the editor's "e" ids. */
export const suggestDocument = (
  text: string,
  catalog: ReadonlyArray<CatalogMovement>,
): ImportDocument => {
  let next = 0;
  return { text, spans: suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`) };
};

/**
 * The programmed item a movement span became, with its block and the station it is a way to do
 * (the item an alternative belongs to); none for a movement in the notes.
 */
const findItem = (
  session: DerivedSession,
  spanId: SpanId,
):
  | { readonly item: DerivedItem; readonly block: DerivedBlock; readonly station: DerivedItem }
  | undefined => {
  for (const part of session.parts)
    for (const block of part.blocks)
      for (const station of block.items) {
        const item = stationOptions(station).find((option) => option.spanId === spanId);
        if (item) return { item, block, station };
      }
  return undefined;
};

/** Programmed items in protocol order, alternatives after their item: the `j` / `k` order. */
const programmedItems = (session: DerivedSession): ReadonlyArray<DerivedItem> => {
  const walk = (items: ReadonlyArray<DerivedItem>): ReadonlyArray<DerivedItem> =>
    items.flatMap((item) => [item, ...walk(item.alternatives)]);
  return walk(session.parts.flatMap((part) => part.blocks.flatMap((block) => block.items)));
};

/** Lift set rows the save will write: notes sets times their count, plus every performed set. */
const liftSetCount = (session: DerivedSession) => {
  const performed = (items: ReadonlyArray<DerivedItem>): number =>
    items.reduce((total, item) => total + item.performed.length + performed(item.alternatives), 0);
  return (
    session.liftSets.reduce((total, set) => total + set.count, 0) +
    performed(session.parts.flatMap((part) => part.blocks.flatMap((block) => block.items)))
  );
};

/**
 * `log` saves a session that was done (from a paste, a stored import, or a plan); `plan` saves
 * the posted workout before it is done, with a planned scaling per movement and no results or
 * debrief.
 */
export type WorkbenchMode = "log" | "plan";

export function ImportWorkbench({
  initial,
  replace,
  catalog,
  onSaved,
  onDiscard,
  mode = "log",
  plan,
  onPlanned,
}: {
  readonly initial: ImportDocument;
  /** The stored import this editor rewrites, when re-opened. */
  readonly replace: WorkoutId | undefined;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly onSaved?: (summary: ImportSummary) => void;
  readonly onDiscard: () => void;
  readonly mode?: WorkbenchMode;
  /** Planning: the plan this editor rewrites. Logging: the plan the session is logged from. */
  readonly plan?: PlanId | undefined;
  readonly onPlanned?: (plan: SessionPlan) => void;
}) {
  const planning = mode === "plan";
  /** Planning, or logging a plan: the plan is the work, so it leads the screen. */
  const outcomeFirst = planning || plan !== undefined;
  const [state, dispatch] = useReducer(editorReducer, initial, (document) => {
    const start = initialEditorState(document);
    if (!outcomeFirst) return start;
    // Open on the first movement still to plan (or to log), not on the tag keys.
    const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
    const items = programmedItems(deriveSession(document, (id) => names.get(id)));
    const open = items.find((item) => {
      const span = document.spans.find((candidate) => candidate.id === item.spanId);
      return span?._tag === "movement" && (planning ? span.plan : span.performance) === undefined;
    });
    return { ...start, selectedId: (open ?? items[0])?.spanId };
  });
  /** Bumped when a plan is taken as done, so the open inspector re-reads the span. */
  const [revision, setRevision] = useState(0);
  const [undo, setUndo] = useState<
    | {
        readonly previous: ReadonlyArray<SpanOf<"movement">>;
        readonly applied: ReadonlyArray<SpanOf<"movement">>;
      }
    | undefined
  >();
  const [pristine] = useState(() => JSON.stringify(toDocument(initialEditorState(initial))));
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [selection, setSelection] = useState<TextRange | undefined>();
  const [hovered, setHovered] = useState<SpanId | undefined>();
  const [status, setStatus] = useState<SaveStatus>({ type: "idle" });
  const saveImport = useAtomSet(saveImportAtom, { mode: "promiseExit" });
  const savePlan = useAtomSet(savePlanAtom, { mode: "promiseExit" });
  const editing = replace !== undefined || (planning && plan !== undefined);
  const debriefField = useRef<HTMLInputElement>(null);

  const matcher = makeMovementMatcher(catalog);
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const nameOf = (id: MovementId) => names.get(id);
  const cores = new Map(
    catalog.flatMap((movement) =>
      movement.variationOf === undefined ? [] : [[movement.id, movement.variationOf] as const],
    ),
  );
  const categories = new Map(catalog.map((movement) => [movement.id, movement.category]));
  const coreOf = (id: MovementId) => {
    const core = cores.get(id);
    return core === undefined ? undefined : names.get(core);
  };
  const document = toDocument(state);
  const session = deriveSession(document, nameOf);
  // A plan keeps its name while it is logged; a pasted session is named by its heading.
  const title = session.name;
  const errors = session.issues.filter((issue) => issue.severity === "error");
  const selected = state.spans.find((span) => span.id === state.selectedId);
  const programmed = selected?._tag === "movement" ? findItem(session, selected.id) : undefined;
  const sex = useAthleteSex();
  const grades = gradeSession(session, catalog, sex, planning ? "planned" : "done");
  const complexes = findComplexes(session, document, (id) => categories.get(id));
  const selectedComplex =
    programmed === undefined || selected === undefined ? undefined : complexes.get(selected.id);
  /** The selected movement's complex with every movement's item, defaults and grade. */
  const complexInspection: ComplexInspection | undefined =
    selectedComplex === undefined
      ? undefined
      : {
          shared: selectedComplex.shared,
          members: selectedComplex.members.flatMap((id) => {
            const span = state.spans.find((candidate) => candidate.id === id);
            const found = findItem(session, id);
            return span?._tag === "movement" && found
              ? [
                  {
                    span,
                    item: found.item,
                    defaults: withPlannedLoad(resultDefaults(found.item, found.block), span.plan),
                    grade: grades.byItem.get(id),
                  },
                ]
              : [];
          }),
          onUpdateAll: (spans) => {
            for (const span of spans) dispatch({ type: "update", span });
          },
        };
  /** The selected movement and, in a complex sharing one bar, the rest of it. */
  const selectedMovements = (): ReadonlyArray<SpanOf<"movement">> =>
    complexInspection?.shared
      ? complexInspection.members.map((member) => member.span)
      : selected?._tag === "movement"
        ? [selected]
        : [];
  const items = programmedItems(session);
  /**
   * Movements with a plan and nothing recorded yet: what "Log all as planned" fills. A station
   * already done by one option ("did 90 SU, not the planned DU") keeps that choice.
   */
  const recordedStations = new Set(
    session.parts
      .flatMap((part) => part.blocks.flatMap((block) => block.items))
      .map(stationOptions)
      .filter((options) => options.some((option) => option.performance !== undefined))
      .flatMap((options) => options.map((option) => option.spanId)),
  );
  const unloggedPlans = planning
    ? []
    : state.spans.filter(
        (span): span is SpanOf<"movement"> =>
          span._tag === "movement" &&
          span.plan !== undefined &&
          span.performance === undefined &&
          !recordedStations.has(span.id),
      );

  function takeAsPlanned(spans: ReadonlyArray<SpanOf<"movement">>, undoable = false) {
    const applied = spans.map((span) => asPlanned(span, findItem(session, span.id)));
    for (const span of applied) dispatch({ type: "update", span });
    setRevision((count) => count + 1);
    if (undoable) setUndo({ previous: spans, applied });
  }

  // "All as planned" can be taken back until one of the rows it filled is edited.
  const canUndo =
    undo !== undefined &&
    undo.applied.every(
      (span) =>
        JSON.stringify(state.spans.find((candidate) => candidate.id === span.id)) ===
        JSON.stringify(span),
    );

  function undoAsPlanned() {
    if (undo === undefined) return;
    for (const span of undo.previous) dispatch({ type: "update", span });
    setUndo(undefined);
    setRevision((count) => count + 1);
  }

  // Close and Start over drop the work only after asking, once anything was changed.
  const dirty = JSON.stringify(document) !== pristine;

  function step(by: 1 | -1) {
    if (items.length === 0) return;
    const at = items.findIndex((item) => item.spanId === state.selectedId);
    const next =
      at === -1 ? (by === 1 ? 0 : items.length - 1) : (at + by + items.length) % items.length;
    setSelection(undefined);
    dispatch({ type: "select", id: items[next]!.spanId });
  }
  const pointed = hovered ?? state.selectedId;
  // A complex lights as one: its other movements go with the one pointed at.
  const linked = new Set([
    ...linkedIds(state.spans, pointed),
    ...(pointed === undefined ? [] : (complexes.get(pointed)?.members ?? [])),
  ]);
  // Words left after a movement with a family ("o. line" after "Burpee"): maybe a variation.
  const tails = new Map(
    state.spans.flatMap((span) => {
      if (span._tag !== "movement" || span.movementId === undefined) return [];
      if (variationLadder(span.movementId, catalog, undefined) === undefined) return [];
      const tail = trailingWords(state.text, span, state.spans);
      return tail === undefined ? [] : [[span.id, tail] as const];
    }),
  );
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

  function openDebrief() {
    const field = debriefField.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    // Scroll the protocol pane only: scrollIntoView would also move the page under the band.
    const section = field.closest("section");
    const pane = field.closest("[data-pane-scroll]");
    if (!section || !pane) return;
    pane.scrollTo({
      top: pane.scrollTop + section.getBoundingClientRect().top - pane.getBoundingClientRect().top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
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
    if (event.key.toLowerCase() === "f" && !state.picking && !planning) {
      event.preventDefault();
      openDebrief();
      return;
    }
    if (event.key === "j" || event.key === "k") {
      event.preventDefault();
      step(event.key === "j" ? 1 : -1);
      return;
    }
    if (event.key === "v" && tails.size > 0) {
      event.preventDefault();
      // The next mark with words left over, after the selected one, wrapping round.
      const open = state.spans
        .filter((span) => tails.has(span.id))
        .sort((left, right) => left.start - right.start);
      const from = selected === undefined ? -1 : selected.start;
      const next = open.find((span) => span.start > from) ?? open[0]!;
      setSelection(undefined);
      dispatch({ type: "select", id: next.id });
      return;
    }
    if (event.key === "p" && !planning && selected?._tag === "movement" && selected.plan) {
      event.preventDefault();
      takeAsPlanned(selectedMovements());
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

  async function saveAsPlan() {
    setStatus({ type: "saving" });
    const exit = await savePlan({
      payload: { document, ...(plan === undefined ? {} : { id: plan }) },
      reactivityKeys: [PLANS_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) {
      setStatus({ type: "idle" });
      onPlanned?.(exit.value);
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    setStatus({
      type: "error",
      message:
        Option.isSome(failure) && failure.value._tag === "ImportInvalidError"
          ? failure.value.problems.join(" ")
          : Option.isSome(failure) && failure.value._tag === "PlanNotFoundError"
            ? "This plan is gone: it was logged or deleted somewhere else."
            : "Could not save the plan. Is the server running?",
    });
  }

  async function save(replacing: WorkoutId | undefined) {
    if (planning) return saveAsPlan();
    setStatus({ type: "saving" });
    const exit = await saveImport({
      payload: {
        document,
        ...(replacing === undefined ? {} : { replace: replacing }),
        ...(plan === undefined ? {} : { fromPlan: plan }),
      },
      reactivityKeys: SAVE_REACTIVITY_KEYS,
    });
    if (Exit.isSuccess(exit)) {
      setStatus({ type: "idle" });
      onSaved?.(exit.value);
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
      {outcomeFirst ? (
        // j / k move the selection without moving focus; say where it landed.
        <p aria-live="polite" className="sr-only">
          {selected?._tag === "movement" && selected.movementId !== undefined
            ? (nameOf(selected.movementId) ?? "")
            : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-stretch border-b bg-card">
        <div className="flex min-w-0 max-w-sm flex-col justify-center gap-1 border-r px-5 py-2.5">
          <h1 className="protocol-title truncate text-3xl" title={title}>
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {planning
              ? plan
                ? "Editing a plan"
                : "New plan, not saved yet"
              : replace
                ? "Editing a saved import"
                : plan
                  ? "Logging a planned session"
                  : "New import, not saved yet"}
          </p>
        </div>
        <dl className="flex flex-wrap divide-x border-r">
          <FieldBox label={planning ? "Planned for" : "Date"} wide={!hasDateSpan}>
            {hasDateSpan ? (
              session.performedOn
            ) : (
              <Input
                type="date"
                aria-label={planning ? "Planned for" : "Performed on"}
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
          <FieldBox label="Session" wide>
            <SessionTypeField
              marks={state.marks}
              onChange={(sessionType) => dispatch({ type: "setSessionType", sessionType })}
            />
          </FieldBox>
          <FieldBox label="Coached by" wide>
            <CoachingField
              coaching={state.marks.coaching}
              date={session.performedOn}
              onChange={(coaching, classType) =>
                dispatch({
                  type: "setCoaching",
                  coaching,
                  ...(classType === undefined ? {} : { classType }),
                })
              }
            />
          </FieldBox>
          <FieldBox label="Place" wide>
            <PlaceField
              place={state.place}
              onChange={(place) => dispatch({ type: "setPlace", place })}
            />
          </FieldBox>
          {/* A plan's protocol shows the parts. */}
          {outcomeFirst ? null : <FieldBox label="Parts">{session.parts.length}</FieldBox>}
          <FieldBox label="Movements">
            {/* Stations: "60 DU or 90 SU" is one movement to do. */}
            {session.parts.reduce(
              (total, part) =>
                total + part.blocks.reduce((sum, block) => sum + block.items.length, 0),
              0,
            )}
          </FieldBox>
          {planning ? null : (
            <>
              <FieldBox label="Lifted">
                {formatKg(session.tonnageKg)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {liftSetCount(session) === 1 ? "1 set" : `${liftSetCount(session)} sets`}
                </span>
              </FieldBox>
            </>
          )}
          {grades.programmed ? (
            <FieldBox label="Board level">
              <LevelBadge level={levelKey(grades.programmed.level)} open>
                {levelName(grades.programmed.level)}
              </LevelBadge>
            </FieldBox>
          ) : null}
          {grades.programmed ? (
            <FieldBox label={planning ? "Planned at" : "Done at"}>
              {grades.performed && grades.unrecorded === 0 ? (
                <LevelBadge level={levelKey(grades.performed.level)}>
                  {levelName(grades.performed.level)}
                </LevelBadge>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">
                  {grades.unrecorded} {planning ? "to plan" : "to record"}
                </span>
              )}
            </FieldBox>
          ) : null}
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <RefereeLamps issues={session.issues} />
          <div className="flex gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" aria-label="Re-suggest marks" title="Re-suggest" />}
              >
                <Highlighter />
                <span className="hidden 2xl:inline">Re-suggest</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Replace all marks?</AlertDialogTitle>
                <AlertDialogDescription>
                  Suggestions run again with the current catalog, including aliases you just taught
                  it. Your manual edits in this session are lost
                  {planning || plan ? ", planned scaling included" : ""}.
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
              aria-label={editing || plan ? "Close" : "Start over"}
              title={editing || plan ? "Close" : "Start over"}
              onClick={() => (dirty ? setConfirmDrop(true) : onDiscard())}
            >
              {editing || plan ? <X /> : <RotateCcw />}
              <span className="hidden 2xl:inline">{editing || plan ? "Close" : "Start over"}</span>
            </Button>
            <AlertDialog open={confirmDrop} onOpenChange={setConfirmDrop}>
              <AlertDialogContent>
                <AlertDialogTitle>Drop your changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  {planning
                    ? "The plan keeps what was last saved."
                    : plan
                      ? "Nothing is logged and the plan stays as it was."
                      : replace
                        ? "The saved import keeps what was last saved."
                        : "The marks and everything entered on this session go."}
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogClose render={<Button variant="outline" />}>
                    Keep editing
                  </AlertDialogClose>
                  <AlertDialogClose render={<Button variant="destructive" />} onClick={onDiscard}>
                    Drop changes
                  </AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              disabled={errors.length > 0 || status.type === "saving"}
              onClick={() => void save(replace)}
              title={errors.length > 0 ? "Fix the issues marked in red first" : undefined}
            >
              <Save />
              {status.type === "saving"
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : planning
                    ? "Save plan"
                    : "Save session"}
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

      <div
        className={
          outcomeFirst
            ? "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,18rem)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,22rem)]"
            : "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,18rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,22rem)]"
        }
      >
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
              tails={tails}
            />
          </div>
        </section>
        <section aria-label="Protocol" className="flex min-h-0 flex-col border-b lg:border-r">
          <PaneHeader
            title="Protocol"
            meta={planning ? "What you will do" : "What will be saved"}
            action={
              planning ? undefined : (
                <span className="flex items-center gap-4">
                  {canUndo ? (
                    <Button variant="ghost" size="sm" onClick={undoAsPlanned}>
                      <Undo2 />
                      Undo all as planned
                    </Button>
                  ) : unloggedPlans.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      title="Record every planned movement as done as planned"
                      onClick={() => takeAsPlanned(unloggedPlans, true)}
                    >
                      <ListChecks />
                      All {unloggedPlans.length} as planned
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    aria-keyshortcuts="f"
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    onClick={openDebrief}
                  >
                    Debrief
                    <kbd data-key>f</kbd>
                  </button>
                </span>
              )
            }
          />
          <div data-pane-scroll className="min-h-0 flex-1 overflow-auto pb-10">
            <SessionProtocol
              session={session}
              names={{
                nameOf,
                coreOf,
                gradeOf: (id) => grades.byItem.get(id),
                gradeSide: planning ? "planned" : "done",
                complexOf: (id) => complexes.get(id),
              }}
              editor={{
                selectedId: state.selectedId,
                linked,
                onSelect: handleClickSpan,
                onHover: setHovered,
                lineOf,
                rulerOnSelectedOnly: outcomeFirst,
                tailOf: (id) => tails.get(id)?.text,
              }}
            />
            {planning ? (
              <PlanSimilar session={session} nameOf={(id) => names.get(id) ?? id} />
            ) : (
              <DebriefSheet
                debrief={state.debrief}
                scores={session.parts.flatMap((part) =>
                  part.blocks.flatMap((block) => block.scores),
                )}
                firstFieldRef={debriefField}
                onChange={(debrief) => dispatch({ type: "setDebrief", debrief })}
              />
            )}
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
                ? outcomeFirst
                  ? planning
                    ? "j k next · esc"
                    : "j k next · p as planned · esc"
                  : "Esc to close"
                : aside === "tag"
                  ? `"${selectedText}"`
                  : "Select text, then press a key"
            }
          />
          <div className="min-h-0 flex-1 overflow-auto">
            {aside === "mark" && selected ? (
              <SpanInspector
                key={`${selected.id}:${revision}:${complexInspection?.shared ?? "single"}`}
                span={selected}
                mode={mode}
                outcomeFirst={outcomeFirst}
                onAsPlanned={plan === undefined ? undefined : (spans) => takeAsPlanned(spans)}
                complex={complexInspection}
                text={state.text}
                spans={state.spans}
                catalog={catalog}
                picking={state.picking}
                programmed={
                  programmed === undefined
                    ? undefined
                    : {
                        item: programmed.item,
                        defaults: withPlannedLoad(
                          resultDefaults(programmed.item, programmed.block),
                          selected?._tag === "movement" ? selected.plan : undefined,
                        ),
                        grade: grades.byItem.get(programmed.item.spanId),
                        station: stationOptions(programmed.station),
                        chosen: chosenOption(programmed.station, planning ? "planned" : "done")
                          ?.spanId,
                      }
                }
                onChooseOption={(chosen) => {
                  if (programmed === undefined) return;
                  const ids = new Set(
                    stationOptions(programmed.station).map((option) => option.spanId),
                  );
                  const options = state.spans.filter(
                    (span): span is SpanOf<"movement"> =>
                      span._tag === "movement" && ids.has(span.id),
                  );
                  for (const span of chooseOption(
                    options,
                    chosen,
                    planning ? "plan" : "performance",
                  ))
                    dispatch({ type: "update", span });
                  dispatch({ type: "select", id: chosen });
                  setRevision((count) => count + 1);
                }}
                onUpdate={(span) => dispatch({ type: "update", span })}
                onRemove={(id) => dispatch({ type: "remove", id })}
                onPick={(mode) => dispatch({ type: "pick", mode })}
                tail={tails.get(selected.id)}
                onVariationPicked={(span, movementId, end, learned) => {
                  const { movementId: _old, ...open } = span;
                  dispatch({
                    type: "update",
                    span:
                      movementId === undefined ? { ...open, end } : { ...span, movementId, end },
                  });
                  if (learned && movementId !== undefined)
                    dispatch({
                      type: "tagPhrase",
                      phrase: state.text.slice(span.start, end),
                      movementId,
                    });
                }}
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

/**
 * Planning: where each part was done before and how it went, to plan the scaling from. A row
 * opens that session in a new tab, so the plan being entered stays.
 */
function PlanSimilar({
  session,
  nameOf,
}: {
  readonly session: DerivedSession;
  readonly nameOf: (id: MovementId) => string;
}) {
  const [today] = useState(() => localIsoDate(new Date()));
  const groups = usePlanEchoes(session, session.performedOn ?? today);
  return (
    <SimilarSessions
      groups={groups}
      nameOf={nameOf}
      onOpen={(workoutId) =>
        window.open(`/workouts?session=${encodeURIComponent(workoutId)}`, "_blank", "noopener")
      }
    />
  );
}

function PaneHeader({
  title,
  meta,
  action,
}: {
  readonly title: string;
  readonly meta: string;
  readonly action?: ReactNode;
}) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <h2 className="form-label text-foreground">{title}</h2>
      <span className="flex min-w-0 items-center gap-4">
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
        {action}
      </span>
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
          <span className="flex items-center gap-1">
            <kbd data-key>1</kbd>–<kbd data-key>8</kbd>
          </span>
          Pick a variation for the words left over
        </p>
        <p className="flex items-center gap-2.5 text-sm">
          <kbd data-key>0</kbd>
          Take the words as the movement itself, and learn them
        </p>
        <p className="flex items-center gap-2.5 text-sm">
          <kbd data-key>v</kbd>
          Next mark with words left over
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
        <p className="flex items-center gap-3 text-sm">
          <span className="font-mono">
            <mark data-tag="movement">Burpee</mark> <span data-tail>o. line</span>
          </span>
          Words left over
        </p>
      </div>
    </div>
  );
}
