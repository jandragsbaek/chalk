import {
  deriveSession,
  type CatalogMovement,
  type MovementId,
  type SessionPlan,
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
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Exit from "effect/Exit";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { plannedMovements, planTitle } from "../../lib/plan.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import { formatDay } from "../../lib/utils.ts";
import { PLANS_REACTIVITY_KEY, plansAtom, removePlanAtom } from "../../state/plans.ts";

/** Plans grouped the way the day reads them: today, coming up, and earlier ones never logged. */
const groupsOf = (plans: ReadonlyArray<SessionPlan>, todayIso: string) =>
  [
    { title: "Today", plans: plans.filter((plan) => plan.plannedOn === todayIso) },
    { title: "Coming up", plans: plans.filter((plan) => plan.plannedOn > todayIso) },
    {
      title: "Not logged",
      plans: plans.filter((plan) => plan.plannedOn < todayIso).toReversed(),
    },
  ].filter((group) => group.plans.length > 0);

function usePlans() {
  return useAtomValue(plansAtom);
}

/** Every plan not logged yet, each with its movements and planned scaling, and the way to log it. */
export function PlanList({
  catalog,
  todayIso,
}: {
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly todayIso: string;
}) {
  const result = usePlans();
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const nameOf = (id: MovementId) => names.get(id);

  return (
    <section aria-labelledby="plans-heading" className="grid content-start gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-3">
        <h2 id="plans-heading" className="protocol-title text-2xl">
          Planned
        </h2>
        {AsyncResult.isSuccess(result) ? (
          <span className="form-label tabular-nums text-muted-foreground">
            {result.value.length} {result.value.length === 1 ? "session" : "sessions"}
          </span>
        ) : null}
      </div>
      <PlanGroups result={result} todayIso={todayIso} nameOf={nameOf} />
    </section>
  );
}

function PlanGroups({
  result,
  todayIso,
  nameOf,
}: {
  readonly result: ReturnType<typeof usePlans>;
  readonly todayIso: string;
  readonly nameOf: (id: MovementId) => string | undefined;
}) {
  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading plans...</p>,
    onFailure: () => <p className="text-sm text-destructive">Could not load your plans.</p>,
    onSuccess: ({ value: plans }) =>
      plans.length === 0 ? (
        <p className="border border-dashed bg-card px-4 py-8 text-sm text-muted-foreground">
          No plans. Paste the workout when the box posts it, plan the scaling, and log what you did
          from here after the session.
        </p>
      ) : (
        groupsOf(plans, todayIso).map((group) => (
          <div key={group.title} className="grid gap-2">
            <h3 className="form-label text-muted-foreground">{group.title}</h3>
            <ol className="divide-y border bg-card">
              {group.plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} nameOf={nameOf} todayIso={todayIso} />
              ))}
            </ol>
          </div>
        ))
      ),
  });
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** One plan as a register row: the day, what it is with each movement's scaling, its actions. */
function PlanRow({
  plan,
  nameOf,
  todayIso,
}: {
  readonly plan: SessionPlan;
  readonly todayIso: string;
  readonly nameOf: (id: MovementId) => string | undefined;
}) {
  const removePlan = useAtomSet(removePlanAtom, { mode: "promiseExit" });
  const [failed, setFailed] = useState(false);
  const sex = useAthleteSex();
  const session = deriveSession(plan.document, nameOf);
  const movements = plannedMovements(session, nameOf, sex);
  const title = planTitle(session, nameOf);
  const day = new Date(`${plan.plannedOn}T00:00:00`);

  async function remove() {
    const exit = await removePlan({
      params: { id: plan.id },
      reactivityKeys: [PLANS_REACTIVITY_KEY],
    });
    setFailed(Exit.isFailure(exit));
  }

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-3">
      <span className="grid leading-tight">
        <span className="form-label text-muted-foreground">{weekdayFormat.format(day)}</span>
        <span className="text-sm font-semibold tabular-nums">{dayFormat.format(day)}</span>
      </span>
      <div className="grid min-w-0 gap-1.5">
        <span className="truncate font-semibold">{title}</span>
        {movements.length > 0 ? (
          <ul className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-sm">
            {movements.map((movement) => (
              <li key={movement.spanId} className="grid grid-cols-subgrid col-span-2">
                <span className="text-muted-foreground">{movement.name}</span>
                <span
                  className={
                    movement.plan === undefined
                      ? "truncate text-muted-foreground"
                      : "truncate font-medium"
                  }
                >
                  {movement.plan ?? "No plan"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {failed ? <p className="text-sm text-destructive">Could not delete the plan.</p> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          // Ink for what can be done now; a plan for a later day is not logged yet.
          variant={plan.plannedOn > todayIso ? "outline" : "default"}
          render={<Link to="/import" search={{ plan: plan.id }} />}
        >
          Log it
        </Button>
        <Button variant="ghost" size="sm" render={<Link to="/plan" search={{ plan: plan.id }} />}>
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="ghost-destructive" size="icon" aria-label={`Delete ${title}`} />
            }
          >
            <Trash2 />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {title} on {formatDay(plan.plannedOn)} and its planned scaling go. Nothing logged is
              touched.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" />}>Keep it</AlertDialogClose>
              <AlertDialogClose
                render={<Button variant="destructive" />}
                onClick={() => void remove()}
              >
                Delete plan
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
