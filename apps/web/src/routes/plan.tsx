import {
  classMarks,
  PlanId,
  type CatalogMovement,
  type SessionMarks,
  type SessionPlan,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Label, Textarea } from "@chalk/ui/components/field.tsx";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { Highlighter } from "lucide-react";
import { useState } from "react";

import { BoardPull } from "../components/bookingboard/BoardPull.tsx";
import { ImportWorkbench, suggestDocument } from "../components/import/ImportWorkbench.tsx";
import { PlanList } from "../components/plan/PlanList.tsx";
import { formatDay, localIsoDate } from "../lib/utils.ts";
import { catalogAtom } from "../state/imports.ts";
import { planAtom } from "../state/plans.ts";

/** `?plan=<id>` re-opens a plan to change it; without it the page starts at the paste box. */
const PlanSearch = Schema.Struct({ plan: Schema.optional(PlanId) });

export const Route = createFileRoute("/plan")({
  validateSearch: Schema.toStandardSchemaV1(PlanSearch),
  component: PlanPage,
});

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

function PlanPage() {
  const { plan } = Route.useSearch();
  return (
    <main className="flex flex-1 flex-col">
      <PlanEditor plan={plan} />
    </main>
  );
}

function PlanEditor({ plan }: { readonly plan: PlanId | undefined }) {
  const catalog = useAtomValue(catalogAtom);
  return AsyncResult.match(catalog, {
    onInitial: () => <Notice>Loading the movement catalog...</Notice>,
    onFailure: () => (
      <Notice tone="error">Could not load the catalog. Is the server running?</Notice>
    ),
    onSuccess: ({ value }) =>
      plan === undefined ? (
        <PlanPaste catalog={value} />
      ) : (
        <StoredPlanEditor key={plan} id={plan} catalog={value} />
      ),
  });
}

type Draft = {
  readonly key: number;
  readonly text: string;
  readonly marks: SessionMarks;
};

/** The morning: paste the posted workout, mark it up, plan the scaling, save for later. */
function PlanPaste({ catalog }: { readonly catalog: ReadonlyArray<CatalogMovement> }) {
  const [today] = useState(() => localIsoDate(new Date()));
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | undefined>();
  const [saved, setSaved] = useState<SessionPlan | undefined>();
  // The pulled class's coach and type, until the text is cleared.
  const [pulledMarks, setPulledMarks] = useState<SessionMarks>({});

  function handleSuggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim() === "") return;
    setSaved(undefined);
    setDraft({
      key: Date.now(),
      text: text.replace(/\r\n/g, "\n").trimEnd(),
      marks: pulledMarks,
    });
  }

  if (draft)
    return (
      <ImportWorkbench
        key={draft.key}
        mode="plan"
        // A posted board rarely has a date line; it is for today unless it says otherwise.
        initial={{
          ...suggestDocument(draft.text, catalog),
          performedOn: today,
          ...draft.marks,
        }}
        replace={undefined}
        catalog={catalog}
        onPlanned={(plan) => {
          setSaved(plan);
          setDraft(undefined);
          setText("");
          setPulledMarks({});
        }}
        onDiscard={() => setDraft(undefined)}
      />
    );

  return (
    <div className="mx-auto grid w-full max-w-7xl content-start gap-x-10 gap-y-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form className="grid content-start gap-4" onSubmit={handleSuggest}>
        <div className="grid gap-2 border-b-2 border-foreground pb-3">
          <h1 className="protocol-title text-4xl">Plan a session</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Paste the workout the box posted, or pull today's from bookingboard, plan each
            movement's scaling, and log it from the plan after training.
          </p>
        </div>
        {saved ? (
          <div role="status" className="flex items-center gap-3 border bg-card px-3 py-2.5">
            <span data-lamps aria-hidden className="flex items-center gap-1.5 px-2 py-1.5">
              <span data-lamp="good" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">Planned {saved.name}</span> for{" "}
              {formatDay(saved.plannedOn)}. Log it from the list when you have done it.
            </p>
          </div>
        ) : null}
        <BoardPull
          date={today}
          onPulled={(entry) => {
            setText(entry.text);
            setPulledMarks(classMarks(entry));
          }}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="plan-text">Posted workout</Label>
          <div className="font-mono">
            <Textarea
              id="plan-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value.trim() === "") setPulledMarks({});
              }}
              placeholder={"For time\n21-15-9\nThrusters @43/29 kg\nPull-ups"}
              className="min-h-80"
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
            For today unless the text has a date.
          </span>
        </div>
      </form>
      <PlanList catalog={catalog} todayIso={today} />
    </div>
  );
}

function StoredPlanEditor({
  id,
  catalog,
}: {
  readonly id: PlanId;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const result = useAtomValue(planAtom(id));
  const navigate = useNavigate({ from: "/plan" });
  const close = () => void navigate({ search: {} });

  return AsyncResult.match(result, {
    onInitial: () => <Notice>Loading the plan...</Notice>,
    onFailure: () => (
      <Notice tone="error">Could not load this plan. It may have been logged already.</Notice>
    ),
    onSuccess: ({ value: plan }) => (
      <ImportWorkbench
        mode="plan"
        plan={plan.id}
        initial={plan.document}
        replace={undefined}
        catalog={catalog}
        onPlanned={close}
        onDiscard={close}
      />
    ),
  });
}
