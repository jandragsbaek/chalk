import {
  PlanId,
  WorkoutId,
  type CatalogMovement,
  type ImportDocument,
  type ImportSummary,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Label, Textarea } from "@chalk/ui/components/field.tsx";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { Highlighter } from "lucide-react";
import { useState } from "react";

import { BoardPull } from "../components/bookingboard/BoardPull.tsx";
import { ImportedList } from "../components/import/ImportedList.tsx";
import { ImportWorkbench, suggestDocument } from "../components/import/ImportWorkbench.tsx";
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

function PasteFlow({ catalog }: { readonly catalog: ReadonlyArray<CatalogMovement> }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | undefined>();
  const [saved, setSaved] = useState<ImportSummary | undefined>();
  const [today] = useState(() => localIsoDate(new Date()));
  const [boardDay, setBoardDay] = useState(yesterday);
  // The day of the pulled program: board text has no date line, so the draft carries it.
  const [pulledOn, setPulledOn] = useState<string | undefined>();
  const imported = AsyncResult.getOrElse(useAtomValue(importsAtom), () => []);
  const importedOnDay = imported.find((entry) => entry.performedOn === boardDay);

  function handleSuggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim() === "") return;
    setSaved(undefined);
    const document = suggestDocument(text.replace(/\r\n/g, "\n").trimEnd(), catalog);
    setDraft({
      key: Date.now(),
      document: pulledOn === undefined ? document : { ...document, performedOn: pulledOn },
    });
  }

  if (draft)
    return (
      <ImportWorkbench
        key={draft.key}
        initial={draft.document}
        replace={undefined}
        catalog={catalog}
        onSaved={(summary) => {
          setSaved(summary);
          setDraft(undefined);
          setText("");
          setPulledOn(undefined);
        }}
        onDiscard={() => setDraft(undefined)}
      />
    );

  return (
    <div className="mx-auto grid w-full max-w-7xl content-start gap-x-10 gap-y-8 px-6 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form className="grid content-start gap-4" onSubmit={handleSuggest}>
        <div className="grid gap-2 border-b-2 border-foreground pb-3">
          <h1 className="protocol-title text-4xl">Import a session</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Paste one session as written in your notes. Chalk marks the date, formats, movements and
            numbers; you correct the marks until the protocol reads like the whiteboard.
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
              <span className="font-semibold">Saved {saved.name}</span> ({saved.performedOn}):{" "}
              {saved.itemCount === 1 ? "1 movement" : `${saved.itemCount} movements`},{" "}
              {saved.liftSetCount === 1 ? "1 lift set" : `${saved.liftSetCount} lift sets`}. Paste
              the next one.
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
              onChange={(event) => setBoardDay(event.target.value)}
            />
            <BoardPull
              key={boardDay}
              date={boardDay}
              disabled={boardDay === ""}
              onPulled={(entry) => {
                setText(entry.text);
                setPulledOn(boardDay);
              }}
            />
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
              id="session-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value.trim() === "") setPulledOn(undefined);
              }}
              placeholder="Paste a session, from its ** Session heading down to its notes, or pull a class from bookingboard and add your results"
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
          <span className="text-xs text-muted-foreground">
            Nothing is saved until you press Save on the next screen.
          </span>
        </div>
      </form>
      <ImportedList />
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
