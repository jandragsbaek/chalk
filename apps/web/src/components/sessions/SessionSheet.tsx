import {
  benchmarkById,
  deriveSession,
  describeDebrief,
  estimateBenchmarkWork,
  estimateSessionWork,
  workModelsFor,
  formatPerformed,
  tonnageOf,
  type CatalogMovement,
  type Debrief,
  type LiftSet,
  type MovementId,
  type SessionEntry,
  type Workout,
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
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as Exit from "effect/Exit";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { ArrowRight, PenLine, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatKg } from "../../lib/blockLabels.ts";
import { gradeSession } from "../../lib/levelGrades.ts";
import { findComplexes } from "../../lib/complexes.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import type { PartEchoGroup } from "../../lib/similar.ts";
import {
  bodyOn,
  describeBody,
  formatClock,
  formatKj,
  formatWatts,
  useProfile,
} from "../../lib/power.ts";
import { formatDay } from "../../lib/utils.ts";
import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { IMPORTS_REACTIVITY_KEY, storedImportAtom } from "../../state/imports.ts";
import { removeWorkoutAtom } from "../../state/sessions.ts";
import { LIFTS_REACTIVITY_KEY } from "../../state/strength.ts";
import { WORKOUTS_REACTIVITY_KEY } from "../../state/workouts.ts";
import { FieldBox } from "../FieldBox.tsx";
import { SectionHeader, SessionProtocol } from "../import/SessionProtocol.tsx";
import { WorkSection } from "./WorkSection.tsx";
import { SimilarSessions } from "./SimilarSessions.tsx";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export interface Names {
  readonly nameOf: (id: MovementId) => string;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}

function DeleteWorkout({
  workout,
  imported,
  onDeleted,
}: {
  readonly workout: Workout;
  readonly imported: boolean;
  readonly onDeleted: () => void;
}) {
  const remove = useAtomSet(removeWorkoutAtom, { mode: "promiseExit" });
  const [failed, setFailed] = useState(false);

  async function handleConfirm() {
    setFailed(false);
    const exit = await remove({
      params: { id: workout.id },
      reactivityKeys: [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY, IMPORTS_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) onDeleted();
    else setFailed(true);
  }

  return (
    <>
      {failed ? (
        <span role="alert" className="text-xs text-destructive">
          Could not delete. Is the server running?
        </span>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost-destructive"
              size="icon"
              aria-label={`Delete ${workout.name}`}
              title="Delete"
            />
          }
        >
          <Trash2 />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {workout.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {imported
              ? `Trained on ${formatDay(workout.performedOn)}. The imported text, its protocol and its lift sets go with it. This cannot be undone.`
              : `Logged on ${formatDay(workout.performedOn)}${workout.score === "" ? "" : ` with score ${workout.score}`}. This cannot be undone.`}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <AlertDialogClose
              render={<Button variant="destructive" />}
              onClick={() => void handleConfirm()}
            >
              Delete
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Lift sets logged by hand, one row per movement in logged order. */
function DaySets({
  sets,
  title,
  meta,
  nameOf,
}: {
  readonly sets: ReadonlyArray<LiftSet>;
  readonly title: string;
  readonly meta: string;
  readonly nameOf: (id: MovementId) => string;
}) {
  const byMovement = new Map<MovementId, Array<LiftSet>>();
  for (const set of sets) {
    const list = byMovement.get(set.movementId);
    if (list) list.push(set);
    else byMovement.set(set.movementId, [set]);
  }
  return (
    <section aria-label={title}>
      <SectionHeader title={title} meta={meta} />
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="form-label text-left text-muted-foreground">
            <th className="w-[13rem] px-4 py-1.5 font-semibold">Movement</th>
            <th className="px-4 py-1.5 font-semibold">Sets</th>
            <th className="px-4 py-1.5 text-right font-semibold">Lifted</th>
          </tr>
        </thead>
        <tbody className="divide-y border-b">
          {[...byMovement].map(([movementId, movementSets]) => (
            <tr key={movementId}>
              <th scope="row" className="px-4 py-1.5 text-left font-semibold">
                {nameOf(movementId)}
              </th>
              <td className="px-4 py-1.5 tabular-nums">{formatPerformed(movementSets)}</td>
              <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
                {formatKg(tonnageOf(movementSets))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Typed text as the athlete wrote it: the typewriter face, its line breaks kept. */
function TypedNotes({ title, text }: { readonly title: string; readonly text: string }) {
  return (
    <section aria-label={title}>
      <SectionHeader title={title} meta="As written" />
      <p className="max-w-prose whitespace-pre-line px-4 py-3 font-mono text-sm leading-6">
        {text}
      </p>
    </section>
  );
}

function DebriefRead({ debrief }: { readonly debrief: Debrief }) {
  const lines = describeDebrief(debrief);
  const notes = debrief.notes?.trim();
  if (lines.length === 0 && !notes) return null;
  return (
    <section aria-label="Debrief">
      <SectionHeader title="Debrief" meta="What the coach reads" />
      <div className="px-4 py-3">
        <div data-coach-reads className="grid max-w-prose gap-1 px-3 py-2 text-sm">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {notes ? <p className="whitespace-pre-line font-mono leading-6">{notes}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** An imported session read back from its stored text: the protocol as it was saved. */
function ImportedProtocol({
  workoutId,
  names,
}: {
  readonly workoutId: WorkoutId;
  readonly names: Names;
}) {
  const sex = useAthleteSex();
  const result = useAtomValue(storedImportAtom(workoutId));
  const profile = useProfile();
  return AsyncResult.match(result, {
    onInitial: () => (
      <p className="px-4 py-8 text-sm text-muted-foreground">Reading the protocol...</p>
    ),
    onFailure: () => (
      <p className="px-4 py-8 text-sm text-destructive">
        Could not load this session's protocol. Is the server running?
      </p>
    ),
    onSuccess: ({ value: stored }) => {
      const byId = new Map(names.catalog.map((movement) => [movement.id, movement]));
      const nameOf = (id: MovementId) => byId.get(id)?.name;
      const coreOf = (id: MovementId) => {
        const core = byId.get(id)?.variationOf;
        return core === undefined ? undefined : byId.get(core)?.name;
      };
      const session = deriveSession(stored.document, nameOf);
      const grades = gradeSession(session, names.catalog, sex);
      const complexes = findComplexes(session, stored.document, (id) => byId.get(id)?.category);
      const body = bodyOn(profile, session.performedOn ?? stored.summary.performedOn);
      return (
        <>
          <SessionProtocol
            session={session}
            names={{
              nameOf,
              coreOf,
              gradeOf: (id) => grades.byItem.get(id),
              complexOf: (id) => complexes.get(id),
            }}
          />
          <WorkSection
            work={
              body === undefined
                ? undefined
                : estimateSessionWork(session, body, workModelsFor(names.catalog))
            }
            bodyLabel={body === undefined ? "" : describeBody(body)}
            nameOf={names.nameOf}
          />
          {stored.document.debrief ? <DebriefRead debrief={stored.document.debrief} /> : null}
        </>
      );
    },
  });
}

function LoggedResult({ workout }: { readonly workout: Workout }) {
  const benchmark =
    workout.benchmarkId === undefined ? undefined : benchmarkById(workout.benchmarkId);
  const body = bodyOn(useProfile(), workout.performedOn);
  // A scaled attempt's loads are not recorded, so only Rx has a known workload.
  const work =
    benchmark === undefined || body === undefined || !workout.rx
      ? undefined
      : estimateBenchmarkWork(benchmark, workout.score, body, workModelsFor([]));
  return (
    <section aria-label="Result">
      <SectionHeader title="Result" meta={workout.rx ? "As prescribed" : "Scaled"} />
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        {workout.score === "" ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span data-empty aria-hidden />
            No score
          </span>
        ) : (
          <span
            data-result-box
            className="bg-card px-2.5 text-lg font-bold leading-8 tabular-nums font-stretch-semi-condensed"
          >
            {workout.score}
          </span>
        )}
        <Badge variant={workout.rx ? "default" : "muted"}>{workout.rx ? "Rx" : "Scaled"}</Badge>
        {work && body ? (
          <span className="text-sm tabular-nums" title={`Estimated for ${describeBody(body)}`}>
            <span className="font-semibold">{formatWatts(work.watts)}</span>
            <span className="text-muted-foreground">
              {" "}
              · {formatKj(work.joules)} in {formatClock(work.seconds)}
            </span>
          </span>
        ) : null}
        {benchmark ? (
          <Link
            to="/benchmarks/$benchmarkId"
            params={{ benchmarkId: benchmark.id }}
            className="form-label ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            Every {benchmark.name}
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One session, read-only, as a protocol sheet: a header strip of boxed fields, then what was
 * programmed and lifted. Imported sessions read their protocol back from the stored text; a
 * logged workout has its result; then other sessions that repeat or resemble its parts;
 * hand-logged lift sets that day close the sheet.
 */
export function SessionSheet({
  entry,
  names,
  similar,
  onOpen,
  onDeleted,
}: {
  readonly entry: SessionEntry;
  readonly names: Names;
  /** The session's parts that repeat or resemble other sessions' parts. */
  readonly similar: ReadonlyArray<PartEchoGroup>;
  /** Opens another session in the sheet. */
  readonly onOpen: (workoutId: string) => void;
  readonly onDeleted: () => void;
}) {
  const day = entry._tag === "workout" ? entry.workout.performedOn : entry.performedOn;
  const daySetTonnage = tonnageOf(entry.daySets);
  const liftSets =
    entry._tag === "workout" ? entry.liftSetCount + entry.daySets.length : entry.daySets.length;
  const lifted = (entry._tag === "workout" ? entry.tonnageKg : 0) + daySetTonnage;

  return (
    <article aria-label="Session" className="flex min-h-0 flex-col bg-card">
      <header className="border-b">
        <div className="flex items-center gap-4 border-b px-5 py-3">
          <div className="grid min-w-0 gap-1">
            <h2 className="protocol-title truncate text-3xl">
              {entry._tag === "workout" ? entry.workout.name : "Strength day"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {entry._tag === "strengthDay"
                ? "Lift sets logged by hand"
                : entry.imported
                  ? "Imported session"
                  : "Logged workout"}
            </p>
          </div>
          {entry._tag === "workout" ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {entry.imported ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link to="/import" search={{ workout: entry.workout.id }} />}
                >
                  <PenLine />
                  Open in importer
                </Button>
              ) : null}
              <DeleteWorkout
                workout={entry.workout}
                imported={entry.imported}
                onDeleted={onDeleted}
              />
            </div>
          ) : null}
        </div>
        <dl className="flex divide-x">
          {entry._tag === "workout" ? (
            <FieldBox label="Session">
              {entry.sessionNumber === null ? (
                <span data-empty aria-label="No session number" />
              ) : (
                `No. ${entry.sessionNumber}`
              )}
            </FieldBox>
          ) : null}
          <FieldBox label="Date">{formatDay(day)}</FieldBox>
          {entry._tag === "workout" ? (
            <FieldBox label="Kind">{WORKOUT_KIND_LABELS[entry.workout.kind]}</FieldBox>
          ) : null}
          <FieldBox label="Movements">{entry.movementIds.length}</FieldBox>
          <FieldBox label="Lift sets">{liftSets}</FieldBox>
          <FieldBox label="Lifted">
            {lifted > 0 ? formatKg(lifted) : <span data-empty aria-label="Nothing lifted" />}
          </FieldBox>
          <div aria-hidden className="flex-1" />
        </dl>
      </header>

      <div data-sheet-scroll className="min-h-0 flex-1 overflow-y-auto pb-12">
        {entry._tag === "workout" && entry.imported ? (
          <ImportedProtocol workoutId={entry.workout.id} names={names} />
        ) : null}
        {entry._tag === "workout" && !entry.imported ? (
          <LoggedResult workout={entry.workout} />
        ) : null}
        <SimilarSessions groups={similar} nameOf={names.nameOf} onOpen={onOpen} />
        {entry._tag === "workout" && entry.workout.notes.trim() !== "" ? (
          <TypedNotes title="Notes" text={entry.workout.notes} />
        ) : null}
        {entry.daySets.length > 0 ? (
          <DaySets
            sets={entry.daySets}
            title="Lift sets"
            meta={
              entry._tag === "workout"
                ? `${plural(entry.daySets.length, "set", "sets")} logged by hand that day`
                : `${plural(entry.daySets.length, "set", "sets")} from the Log page`
            }
            nameOf={names.nameOf}
          />
        ) : null}
      </div>
    </article>
  );
}
