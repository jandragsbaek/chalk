import {
  ATHLETE_SEX,
  COMPLEMENT_NAMES,
  familyStops,
  LEVEL_FAMILIES,
  LEVEL_GROUP_NAMES,
  LEVEL_NAMES,
  levelKey,
  levelName,
  rungLabel,
  STANDARD,
  UNGRADED_ROWS,
  type LevelGroup,
  type LevelShare,
  type MovementId,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import {
  LevelBadge,
  LevelRuler,
  LevelShareBar,
  type RulerMarker,
} from "@chalk/ui/components/level-ruler.tsx";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import {
  LEVEL_WINDOWS,
  summarizeAccessories,
  summarizeFamilies,
  verdictOf,
  windowStart,
  type AccessorySummary,
  type FamilySummary,
  type LevelWindow,
} from "../lib/levels.ts";
import { levelsAtom, liftSetsAtom } from "../state/strength.ts";

type Tab = LevelGroup | "accessories";

const TABS: ReadonlyArray<{ readonly id: Tab; readonly label: string }> = [
  { id: "barbell", label: LEVEL_GROUP_NAMES.barbell },
  { id: "kb_db", label: LEVEL_GROUP_NAMES.kb_db },
  { id: "gymnastics", label: LEVEL_GROUP_NAMES.gymnastics },
  { id: "functional", label: LEVEL_GROUP_NAMES.functional },
  { id: "accessories", label: "Accessories" },
];

const kgFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const kg = (value: number) => kgFormat.format(value);

function Legend({ tab }: { readonly tab: Tab }) {
  if (tab === "accessories") return null;
  const loads = tab === "barbell" || tab === "kb_db";
  const variants = tab === "gymnastics" || tab === "functional";
  return (
    <ul
      data-level-legend
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <span data-legend-mark="performed" aria-hidden />
        {loads
          ? "Heaviest in a workout"
          : tab === "functional"
            ? "Heaviest, or what most reps were"
            : "What most workout reps were"}
      </li>
      {variants ? (
        <li className="flex items-center gap-1.5">
          <span data-legend-mark="capability" aria-hidden />
          Hardest you have done
        </li>
      ) : null}
      {loads ? (
        <li className="flex items-center gap-1.5">
          <span data-legend-mark="estimate" aria-hidden />
          Estimated 1RM
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <span data-legend-mark="range" aria-hidden />
        What the box programmed
      </li>
    </ul>
  );
}

/** Reps per level, named by the rung's variation ("Jumping", "Pull-up"). */
const shareSegments = (summary: FamilySummary, shares: ReadonlyArray<LevelShare>) =>
  shares.map((share) => ({
    level: levelKey(share.level),
    reps: share.reps,
    label:
      share.level === undefined
        ? "under the sheet"
        : (rungLabel(summary.family, share.level) ?? LEVEL_NAMES[share.level]).toLowerCase(),
  }));

function FamilyRow({
  summary,
  nameOf,
}: {
  readonly summary: FamilySummary;
  readonly nameOf: (id: MovementId) => string;
}) {
  const { family, performed, capability, programmed } = summary;
  const verdict = verdictOf(summary, nameOf);
  const markers: Array<RulerMarker> = [];
  if (capability !== undefined)
    markers.push(
      capability.estimateKg === undefined
        ? {
            kind: "capability",
            position: capability.position,
            title: `Hardest done: ${capability.movementId ? nameOf(capability.movementId) : levelName(capability.level)}${capability.unbroken === undefined ? "" : `, ${capability.unbroken} unbroken`}`,
          }
        : {
            kind: "estimate",
            position: capability.position,
            title: `Estimated 1RM: ${kg(capability.estimateKg)} kg`,
          },
    );
  if (performed !== undefined)
    markers.push({
      kind: "performed",
      position: performed.position,
      ...(performed.loadKg === undefined ? {} : { label: kg(performed.loadKg) }),
      title:
        performed.loadKg === undefined
          ? `Most reps: ${levelName(performed.level)}`
          : `Heaviest in a workout: ${kg(performed.loadKg)} kg, ${levelName(performed.level)}`,
    });

  const summaryText = [
    `${family.name}.`,
    performed === undefined ? "Not done in this window." : `Done at ${levelName(performed.level)}.`,
    programmed === undefined ? "" : "Programmed in this window.",
  ].join(" ");

  return (
    <li data-family-row>
      <div className="grid content-start gap-0.5">
        <span className="font-semibold">{family.name}</span>
        <span className="text-xs text-muted-foreground">
          {summary.sessions === 0
            ? "No recorded sessions"
            : `${summary.sessions} ${summary.sessions === 1 ? "session" : "sessions"}`}
        </span>
      </div>
      <div className="grid content-start gap-1.5">
        <LevelRuler
          stops={familyStops(family)}
          markers={markers}
          range={programmed}
          label={summaryText}
        />
        {family.kind === "variant" && summary.shares.length > 0 ? (
          <LevelShareBar segments={shareSegments(summary, summary.shares)} />
        ) : null}
      </div>
      <div className="grid content-start gap-1">
        <span
          className={
            verdict.quiet
              ? "protocol-title text-base text-muted-foreground"
              : "protocol-title text-lg"
          }
        >
          {verdict.heading}
        </span>
        <span className="text-sm text-muted-foreground">{verdict.detail}</span>
      </div>
    </li>
  );
}

function FamilyBoard({
  group,
  summaries,
  nameOf,
}: {
  readonly group: LevelGroup;
  readonly summaries: ReadonlyMap<string, FamilySummary>;
  readonly nameOf: (id: MovementId) => string;
}) {
  const families = LEVEL_FAMILIES.filter((family) => family.group === group);
  const notes = families.filter((family) => family.note !== undefined);
  return (
    <section aria-label={`${LEVEL_GROUP_NAMES[group]} levels`}>
      <div data-family-row data-head aria-hidden className="form-label text-muted-foreground">
        <span>Family</span>
        <span>
          {group === "gymnastics"
            ? "Variation by rung, share of workout reps"
            : group === "functional"
              ? "Rung by load or variation"
              : `Rung by load, kg (${ATHLETE_SEX === "m" ? "male" : "female"})`}
        </span>
        <span>To the next rung</span>
      </div>
      <ul>
        {families.map((family) => {
          const summary = summaries.get(family.id);
          return summary ? <FamilyRow key={family.id} summary={summary} nameOf={nameOf} /> : null;
        })}
      </ul>
      {notes.length > 0 ? (
        <ul className="grid gap-1 px-6 pt-4 text-xs text-muted-foreground">
          {notes.map((family) => (
            <li key={family.id}>
              <span className="font-semibold text-foreground">{family.name}:</span> {family.note}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AccessoryTable({
  accessories,
  nameOf,
}: {
  readonly accessories: ReadonlyArray<AccessorySummary>;
  readonly nameOf: (id: MovementId) => string;
}) {
  if (accessories.length === 0)
    return (
      <p className="px-6 py-10 text-sm text-muted-foreground">
        No accessories yet. In the importer, pick a movement and mark it as an accessory under
        Levels, with what it complements.
      </p>
    );
  const familyName = (id: string) => LEVEL_FAMILIES.find((family) => family.id === id)?.name ?? id;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="form-label text-left text-muted-foreground">
          <th scope="col" className="border-b px-6 py-1.5 font-semibold">
            Complements
          </th>
          <th scope="col" className="border-b px-3 py-1.5 font-semibold">
            Exercise
          </th>
          <th scope="col" className="border-b px-3 py-1.5 font-semibold">
            Load in the window
          </th>
          <th scope="col" className="border-b px-3 py-1.5 font-semibold">
            Graded as
          </th>
          <th scope="col" className="border-b px-3 py-1.5 font-semibold">
            Builds toward
          </th>
          <th scope="col" className="border-b px-6 py-1.5 text-right font-semibold">
            Sessions
          </th>
        </tr>
      </thead>
      <tbody>
        {accessories.map((accessory) => {
          const { movement } = accessory;
          const prefix = accessory.dual ? "2 × " : "";
          return (
            <tr key={movement.id} className="border-b bg-card">
              <td className="px-6 py-2 align-top">
                <span className="flex flex-wrap gap-1">
                  {(movement.complements ?? []).map((complement) => (
                    <span key={complement} data-complement>
                      {COMPLEMENT_NAMES[complement]}
                    </span>
                  ))}
                  {(movement.complements ?? []).length === 0 ? (
                    <span className="text-muted-foreground">Not tagged</span>
                  ) : null}
                </span>
              </td>
              <th scope="row" className="px-3 py-2 text-left align-top font-semibold">
                {nameOf(movement.id)}
              </th>
              <td className="px-3 py-2 align-top tabular-nums">
                {accessory.firstKg === undefined || accessory.latestKg === undefined ? (
                  <span className="text-muted-foreground">No load recorded</span>
                ) : accessory.firstKg === accessory.latestKg ? (
                  <span className="font-semibold">{`${prefix}${kg(accessory.latestKg)} kg`}</span>
                ) : (
                  <>
                    {`${prefix}${kg(accessory.firstKg)}`} to{" "}
                    <span className="font-semibold">{`${prefix}${kg(accessory.latestKg)} kg`}</span>
                  </>
                )}
              </td>
              <td className="px-3 py-2 align-top">
                {movement.levelFamily === undefined ? (
                  <span className="text-muted-foreground">Not on the sheet</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {familyName(movement.levelFamily)}
                    {accessory.graded ? (
                      <LevelBadge level={levelKey(accessory.graded.level)}>
                        {levelName(accessory.graded.level)}
                      </LevelBadge>
                    ) : null}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 align-top">
                {(movement.supports ?? []).length === 0 ? (
                  <span className="text-muted-foreground">Nothing set</span>
                ) : (
                  (movement.supports ?? []).map(familyName).join(", ")
                )}
              </td>
              <td className="px-6 py-2 text-right align-top tabular-nums">{accessory.sessions}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The open tab's rows, once the catalog, the items and the lift sets have loaded. */
function LevelPanel({ tab, since }: { readonly tab: Tab; readonly since: string | undefined }) {
  const levels = useAtomValue(levelsAtom);
  const lifts = useAtomValue(liftSetsAtom);
  return AsyncResult.match(AsyncResult.all([levels, lifts]), {
    onInitial: () => <p className="px-6 py-10 text-sm text-muted-foreground">Loading levels...</p>,
    onFailure: () => (
      <p className="px-6 py-10 text-sm text-destructive">Could not load your levels.</p>
    ),
    onSuccess: ({ value: [overview, liftSets] }) => {
      const names = new Map(overview.movements.map((movement) => [movement.id, movement.name]));
      const nameOf = (id: MovementId) => names.get(id) ?? id;
      if (tab === "accessories")
        return (
          <AccessoryTable
            accessories={summarizeAccessories(overview.movements, overview.items, liftSets, since)}
            nameOf={nameOf}
          />
        );
      return (
        <FamilyBoard
          group={tab}
          summaries={summarizeFamilies(overview.movements, overview.items, liftSets, since)}
          nameOf={nameOf}
        />
      );
    },
  });
}

/**
 * Where the athlete stands on every row of GymDanmark's level sheet, as rulers: what the
 * workouts put them at, what they can do, and what the box asked for, tab by group.
 */
export function LevelBoard({ today }: { readonly today: Date }) {
  const [tab, setTab] = useState<Tab>("barbell");
  const [range, setRange] = useState<LevelWindow>("90d");

  return (
    <main className="grid content-start gap-0">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-8">
        <h1 className="protocol-title border-b-2 border-foreground pb-1.5 text-4xl">Levels</h1>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1">
            <span className="form-label text-muted-foreground">Standard</span>
            <a
              href={STANDARD.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center text-sm font-semibold underline decoration-input hover:decoration-foreground"
            >
              {STANDARD.name} · {ATHLETE_SEX === "m" ? "Male" : "Female"}
            </a>
          </div>
          <div className="grid gap-1">
            <span id="level-window" className="form-label text-muted-foreground">
              Window
            </span>
            <div role="radiogroup" aria-labelledby="level-window" className="flex">
              {LEVEL_WINDOWS.map((option) => (
                <Button
                  key={option.id}
                  role="radio"
                  aria-checked={range === option.id}
                  variant={range === option.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div
        data-level-tabs
        className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-y bg-card px-6"
      >
        <div role="tablist" aria-label="Level groups" className="flex flex-wrap">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={`level-tab-${option.id}`}
              aria-selected={tab === option.id}
              aria-controls="level-panel"
              data-level-tab
              onClick={() => setTab(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="py-2">
          <Legend tab={tab} />
        </div>
      </div>

      <div id="level-panel" role="tabpanel" aria-labelledby={`level-tab-${tab}`}>
        <LevelPanel tab={tab} since={windowStart(range, today)} />
      </div>

      <footer className="grid gap-1 px-6 pb-16 pt-6 text-xs text-muted-foreground">
        <p>
          Rungs come from GymDanmark's sheet; Elite, drawn with a dashed tick, is Chalk's own (about
          RX plus 20 %). A hatched rung is not on the sheet for that row.
        </p>
        <p>Not graded: {UNGRADED_ROWS.join(" ")}</p>
      </footer>
    </main>
  );
}
