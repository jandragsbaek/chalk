import {
  familyStops,
  LEVEL_NAMES,
  levelIndex,
  levelKey,
  levelName,
  rungLabel,
  type ItemGrade,
  type LevelShare,
  type MovementId,
} from "@chalk/contracts";
import {
  LevelBadge,
  LevelRuler,
  LevelShareBar,
  type RulerMarker,
} from "@chalk/ui/components/level-ruler.tsx";

const kgFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/**
 * Whose level the grade's `performed` side is: what was done, or, while planning, what the
 * athlete means to do. Only the words change.
 */
export type GradeSide = "done" | "planned";

const WORDS = {
  done: { at: "Done at", hardest: "Hardest done", short: "done", none: "not recorded" },
  planned: { at: "Planned at", hardest: "Hardest planned", short: "planned", none: "no plan" },
} as const;

const rulerLabel = (grade: ItemGrade, familyName: string, side: GradeSide) =>
  `${familyName}: board ${levelName(grade.prescribed?.level)}, ${WORDS[side].short} ${grade.performed ? levelName(grade.performed.level) : WORDS[side].none}.`;

/** "12 % at Scaled": the share of reps above the level most reps reached, if any. */
export const shareNote = (grade: ItemGrade): string | undefined => {
  const performed = grade.performed;
  if (performed === undefined || performed.family.kind !== "variant") return undefined;
  const total = performed.shares.reduce((sum, share) => sum + share.reps, 0);
  const above = performed.shares.filter(
    (share) =>
      share.level !== undefined &&
      (performed.level === undefined || levelIndex(share.level) > levelIndex(performed.level)),
  );
  const top = above.at(-1);
  if (total === 0 || top === undefined || top.level === undefined) return undefined;
  const reps = above.reduce((sum, share) => sum + share.reps, 0);
  return `${Math.round((reps / total) * 100)} % at ${LEVEL_NAMES[top.level]} or above`;
};

const markersOf = (
  grade: ItemGrade,
  nameOf: (id: MovementId) => string | undefined,
  side: GradeSide,
) => {
  const markers: Array<RulerMarker> = [];
  const performed = grade.performed;
  const capability = performed?.capability;
  if (capability !== undefined && capability.position !== performed?.position)
    markers.push({
      kind: "capability",
      position: capability.position,
      title: `${WORDS[side].hardest}: ${nameOf(capability.movementId) ?? capability.movementId}${capability.unbroken === undefined ? "" : `, ${capability.unbroken} unbroken`}`,
    });
  if (performed !== undefined)
    markers.push({
      kind: "performed",
      position: performed.position,
      ...(performed.loadKg === undefined ? {} : { label: kgFormat.format(performed.loadKg) }),
      title: `${WORDS[side].at} ${levelName(performed.level)}${performed.loadKg === undefined ? "" : `, ${kgFormat.format(performed.loadKg)} kg`}`,
    });
  return markers;
};

const segmentsOf = (grade: ItemGrade, shares: ReadonlyArray<LevelShare>) =>
  shares.map((share) => ({
    level: levelKey(share.level),
    reps: share.reps,
    label:
      share.level === undefined
        ? "under the sheet"
        : (
            rungLabel(grade.performed?.family ?? grade.family, share.level) ??
            LEVEL_NAMES[share.level]
          ).toLowerCase(),
  }));

/** Board and done as two badges: dashed for what was asked, solid for what was done. */
function Badges({ grade, side }: { readonly grade: ItemGrade; readonly side: GradeSide }) {
  return (
    <>
      {grade.prescribed === undefined ? (
        <span className="text-xs text-muted-foreground">no load written</span>
      ) : (
        <LevelBadge
          level={levelKey(grade.prescribed.level)}
          open
          title={`The board asked for ${levelName(grade.prescribed.level)}`}
        >
          {levelName(grade.prescribed.level)}
        </LevelBadge>
      )}
      <span aria-hidden className="text-muted-foreground">
        to
      </span>
      {grade.performed === undefined ? (
        <span className="text-xs text-muted-foreground">{WORDS[side].none}</span>
      ) : (
        <LevelBadge
          level={levelKey(grade.performed.level)}
          title={`${WORDS[side].at} ${levelName(grade.performed.level)}`}
        >
          {levelName(grade.performed.level)}
        </LevelBadge>
      )}
    </>
  );
}

/**
 * What a protocol row's level line leads with: the planned scaling (a plan, printed dashed) or
 * what was done (solid), in words, with the plan as a note when it was not followed.
 */
export interface LevelLead {
  readonly label: "Planned" | "Done";
  readonly text: string;
  readonly note?: string | undefined;
}

/** One protocol row's level: its lead in words, board to done, a small ruler, any rep split. */
export function LevelLine({
  grade,
  nameOf,
  side = "done",
  lead,
  ruler = true,
}: {
  readonly grade: ItemGrade;
  readonly nameOf: (id: MovementId) => string | undefined;
  readonly side?: GradeSide;
  readonly lead?: LevelLead | undefined;
  /** Off for rows that are not selected while planning; the inspector keeps the full ruler. */
  readonly ruler?: boolean;
}) {
  const note = shareNote(grade);
  const family = grade.performed?.family ?? grade.family;
  return (
    <span
      data-level-line
      data-plan-box={lead?.label === "Planned" ? "" : undefined}
      data-done-box={lead?.label === "Done" ? "" : undefined}
      className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-sm leading-6"
    >
      {lead === undefined ? (
        <span className="form-label text-muted-foreground">Level</span>
      ) : (
        <>
          <span className="form-label text-muted-foreground">{lead.label}</span>
          <span className="font-medium">{lead.text}</span>
          {lead.note === undefined ? null : (
            <span className="text-xs text-muted-foreground">{lead.note}</span>
          )}
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
        </>
      )}
      <Badges grade={grade} side={side} />
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      {ruler ? (
        <span className="ml-auto w-44">
          <LevelRuler
            size="sm"
            stops={familyStops(family)}
            markers={markersOf(grade, nameOf, side)}
            range={
              grade.prescribed && family.id === grade.family.id
                ? { from: grade.prescribed.position, to: grade.prescribed.position }
                : undefined
            }
            label={rulerLabel(grade, family.name, side)}
          />
        </span>
      ) : null}
    </span>
  );
}

/** The inspector's verdict: the family, board and done, the full ruler, and the rep split. */
export function LevelVerdict({
  grade,
  nameOf,
  side = "done",
}: {
  readonly grade: ItemGrade;
  readonly nameOf: (id: MovementId) => string | undefined;
  readonly side?: GradeSide;
}) {
  const family = grade.performed?.family ?? grade.family;
  const shares = grade.performed?.family.kind === "variant" ? grade.performed.shares : [];
  return (
    <div data-result-box className="grid gap-2 bg-background px-2.5 py-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="form-label text-muted-foreground">Graded as</span>
        <span className="text-sm font-semibold">{family.name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <Badges grade={grade} side={side} />
      </span>
      <LevelRuler
        stops={familyStops(family)}
        markers={markersOf(grade, nameOf, side)}
        range={
          grade.prescribed && family.id === grade.family.id
            ? { from: grade.prescribed.position, to: grade.prescribed.position }
            : undefined
        }
        label={rulerLabel(grade, family.name, side)}
      />
      {shares.length > 0 ? <LevelShareBar segments={segmentsOf(grade, shares)} /> : null}
      {family.id !== grade.family.id ? (
        <p className="text-xs text-muted-foreground">
          {side === "done" ? "Done" : "Planned"} as another movement, so it is graded on{" "}
          {family.name}, not {grade.family.name}.
        </p>
      ) : null}
    </div>
  );
}
