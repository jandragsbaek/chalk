import {
  classMarks,
  dayCoaching,
  PlanId,
  WorkoutId,
  type CatalogMovement,
  type ImportDocument,
  type ImportSummary,
  type SessionMarks,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Label, Textarea } from "@chalk/ui/components/field.tsx";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { Highlighter } from "lucide-react";
import { useRef, useState } from "react";

import { BoardPull, useBoardPull } from "../components/bookingboard/BoardPull.tsx";
import { BacklogRail, useBacklog } from "../components/import/BacklogRail.tsx";
import { ImportedList } from "../components/import/ImportedList.tsx";
import { ImportWorkbench, suggestDocument } from "../components/import/ImportWorkbench.tsx";
import { nextOpenDay } from "../lib/backlog.ts";
import { formatDay, localIsoDate } from "../lib/utils.ts";
import { catalogAtom, importsAtom, storedImportAtom } from "../state/imports.ts";
import { planAtom } from "../state/plans.ts";

/**
 * `?workout=<id>` re-opens a stored import; `?plan=<id>` logs a planned session from its plan;
 * without either the page starts at the paste box.
 */
const ImportSearch = Schema.Struct({
  workout: Schema.optional(WorkoutId),
  plan: Schema.optional(PlanId),
});

export const Route = createFileRoute("/import")({
  validateSearch: Schema.toStandardSchemaV1(ImportSearch),
  component: ImportPage,
});

function ImportPage() {
  const { workout, plan } = Route.useSearch();
  return (
    <main className="flex flex-1 flex-col">
      <ImportEditor workout={workout} plan={plan} />
    </main>
  );
}

function Notice({ tone, children }: { tone?: "error"; children: React.ReactNode }) {
  return (
    <p
      className={
        tone === "error"
          ? "px-6 py-8 text-sm text-destructive"
          : "px-6 py-8 text-sm text-muted-foreground"
      }
    >
      {children}
    </p>
  );
}

function ImportEditor({
  workout,
  plan,
}: {
  readonly workout: WorkoutId | undefined;
  readonly plan: PlanId | undefined;
}) {
  const catalog = useAtomValue(catalogAtom);
  return AsyncResult.match(catalog, {
    onInitial: () => <Notice>Loading the movement catalog...</Notice>,
    onFailure: () => (
      <Notice tone="error">Could not load the catalog. Is the admin server running?</Notice>
    ),
    onSuccess: ({ value }) =>
      workout !== undefined ? (
        <StoredImportEditor key={workout} workoutId={workout} catalog={value} />
      ) : plan !== undefined ? (
        <PlanLogEditor key={plan} id={plan} catalog={value} />
      ) : (
        <PasteFlow catalog={value} />
      ),
  });
}

type Draft = { readonly key: number; readonly document: ImportDocument };

/** Yesterday, the usual day to backfill from bookingboard. */
const yesterday = () => {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  return localIsoDate(day);
};

/** The rail of class days beside the paste box, each scrolling on its own, like /workouts. */
const DESK = "grid h-[calc(100dvh-3rem)] grid-cols-[25rem_minmax(0,1fr)]";

type Saved = { readonly summary: ImportSummary; readonly next: string | undefined };

function PasteFlow({ catalog }: { readonly catalog: ReadonlyArray<CatalogMovement> }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | undefined>();
  const [saved, setSaved] = useState<Saved | undefined>();
  const [today] = useState(() => localIsoDate(new Date()));
  const [boardDay, setBoardDay] = useState(yesterday);
  // A day picked from the class days: saving it moves on to the next one to log.
  const [fromBacklog, setFromBacklog] = useState(false);
  // The pulled class's day, coach and type: board text has none, so the draft carries them.
  const [pulled, setPulled] = useState<
    { readonly on: string; readonly marks: SessionMarks } | undefined
  >();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const source = useBacklog();

  /** Into the text, at its end, ready for the results. */
  function focusText() {
    requestAnimationFrame(() => {
      const field = textRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  const puller = useBoardPull({
    onPulled: (entry, on) => {
      setText(entry.text);
      setPulled({ on, marks: classMarks(entry) });
      focusText();
    },
    // Open gym or nothing posted: what gets typed still lands on that day, solo.
    onNoProgram: (day) => {
      const coaching = dayCoaching(day);
      setPulled({ on: day.date, marks: coaching === undefined ? {} : { coaching } });
      focusText();
    },
  });
  const imported = AsyncResult.getOrElse(useAtomValue(importsAtom), () => []);
  const importedOnDay = imported.find((entry) => entry.performedOn === boardDay);

  function pick(date: string) {
    setBoardDay(date);
    setFromBacklog(true);
    setText("");
    setPulled(undefined);
    void puller.run(date);
    requestAnimationFrame(() =>
      document.querySelector(`[data-backlog-pull="${date}"]`)?.scrollIntoView({ block: "nearest" }),
    );
  }

  function handleSuggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim() === "") return;
    setSaved(undefined);
    const document = suggestDocument(text.replace(/\r\n/g, "\n").trimEnd(), catalog);
    setDraft({
      key: Date.now(),
      document:
        pulled === undefined ? document : { ...document, performedOn: pulled.on, ...pulled.marks },
    });
  }

  function handleSaved(summary: ImportSummary) {
    setDraft(undefined);
    setText("");
    setPulled(undefined);
    // Oldest first: on to the next class day still to log, already pulled.
    const next =
      fromBacklog && source._tag === "ready"
        ? nextOpenDay(source.backlog, summary.performedOn)
        : undefined;
    setSaved({ summary, next: next?.date });
    if (next !== undefined) pick(next.date);
    else setFromBacklog(false);
  }

  if (draft)
    return (
      <ImportWorkbench
        key={draft.key}
        initial={draft.document}
        replace={undefined}
        catalog={catalog}
        onSaved={handleSaved}
        onDiscard={() => {
          setDraft(undefined);
          focusText();
        }}
      />
    );

  return (
    <div className={DESK}>
      <BacklogRail source={source} selectedDay={boardDay} onPick={pick} />
      <div className="min-h-0 overflow-y-auto">
        <div className="grid max-w-5xl gap-12 px-10 py-6">
          <form className="grid content-start gap-4" onSubmit={handleSuggest}>
            <div className="grid gap-2 border-b-2 border-foreground pb-3">
              <h1 className="protocol-title text-4xl">Import a session</h1>
              <p className="max-w-prose text-sm text-muted-foreground">
                Paste one session as written in your notes, or pull a class day and add your
                results. Chalk marks the date, formats, movements and numbers; you correct the marks
                until the protocol reads like the whiteboard.
              </p>
            </div>
            {saved ? (
              <div role="status" className="flex items-center gap-3 border bg-card px-3 py-2.5">
                <span data-lamps aria-hidden className="flex items-center gap-1.5 px-2 py-1.5">
                  <span data-lamp="good" />
                  <span data-lamp="good" />
                  <span data-lamp="good" />
                </span>
                <p className="text-sm">
                  <span className="font-semibold">Saved {saved.summary.name}</span> (
                  {formatDay(saved.summary.performedOn)}):{" "}
                  {saved.summary.itemCount === 1
                    ? "1 movement"
                    : `${saved.summary.itemCount} movements`}
                  ,{" "}
                  {saved.summary.liftSetCount === 1
                    ? "1 lift set"
                    : `${saved.summary.liftSetCount} lift sets`}
                  .{" "}
                  {saved.next === undefined
                    ? "Paste the next one."
                    : `Next to log: ${formatDay(saved.next)}, pulled below.`}
                </p>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="board-day">Class on</Label>
              <div className="flex flex-wrap items-start gap-3">
                <Input
                  id="board-day"
                  type="date"
                  className="w-auto"
                  value={boardDay}
                  max={today}
                  onChange={(event) => {
                    setBoardDay(event.target.value);
                    setFromBacklog(false);
                    puller.reset();
                  }}
                />
                <BoardPull date={boardDay} disabled={boardDay === ""} puller={puller} />
              </div>
              {importedOnDay ? (
                <p className="text-xs text-muted-foreground">
                  {formatDay(boardDay)} already has {importedOnDay.name} imported; saving another
                  session that day asks before replacing it.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="session-text">Session text</Label>
              <div className="font-mono">
                <Textarea
                  ref={textRef}
                  id="session-text"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    if (event.target.value.trim() === "") setPulled(undefined);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  aria-keyshortcuts="Control+Enter"
                  placeholder="Paste a session, org or plain text, from its Session line down to its notes, or pull a class day and add your results"
                  className="min-h-96"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={text.trim() === ""}>
                <Highlighter />
                Suggest marks
              </Button>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd data-key>Ctrl</kbd>
                <kbd data-key>Enter</kbd>
                in the text does the same. Nothing is saved until you press Save on the next screen.
              </span>
            </div>
          </form>
          <ImportedList />
        </div>
      </div>
    </div>
  );
}

function StoredImportEditor({
  workoutId,
  catalog,
}: {
  readonly workoutId: WorkoutId;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const result = useAtomValue(storedImportAtom(workoutId));
  const navigate = useNavigate({ from: "/import" });
  const close = () => void navigate({ search: {} });

  return AsyncResult.match(result, {
    onInitial: () => <Notice>Loading the session...</Notice>,
    onFailure: () => <Notice tone="error">Could not load this import.</Notice>,
    onSuccess: ({ value: stored }) => (
      <ImportWorkbench
        initial={stored.document}
        replace={stored.summary.workoutId}
        catalog={catalog}
        onSaved={close}
        onDiscard={close}
      />
    ),
  });
}

/** After the session: the plan's marks and planned scaling, ready for what was done. */
function PlanLogEditor({
  id,
  catalog,
}: {
  readonly id: PlanId;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const result = useAtomValue(planAtom(id));
  const navigate = useNavigate();

  return AsyncResult.match(result, {
    onInitial: () => <Notice>Loading the plan...</Notice>,
    onFailure: () => (
      <Notice tone="error">Could not load this plan. It may have been logged already.</Notice>
    ),
    onSuccess: ({ value: plan }) => (
      <ImportWorkbench
        plan={plan.id}
        initial={plan.document}
        replace={undefined}
        catalog={catalog}
        onSaved={() => void navigate({ to: "/" })}
        // Back to where "Log it" was pressed (Today or the plan list).
        onDiscard={() =>
          window.history.length > 1 ? window.history.back() : void navigate({ to: "/plan" })
        }
      />
    ),
  });
}
