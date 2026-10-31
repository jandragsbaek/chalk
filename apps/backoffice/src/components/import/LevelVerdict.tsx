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

const markersOf = (grade: ItemGrade, nameOf: (id: MovementId) => string | undefined) => {
  const markers: Array<RulerMarker> = [];
  const performed = grade.performed;
  const capability = performed?.capability;
  if (capability !== undefined && capability.position !== performed?.position)
    markers.push({
      kind: "capability",
      position: capability.position,
      title: `Hardest done: ${nameOf(capability.movementId) ?? capability.movementId}${capability.unbroken === undefined ? "" : `, ${capability.unbroken} unbroken`}`,
    });
  if (performed !== undefined)
    markers.push({
      kind: "performed",
      position: performed.position,
      ...(performed.loadKg === undefined ? {} : { label: kgFormat.format(performed.loadKg) }),
      title: `Done at ${levelName(performed.level)}${performed.loadKg === undefined ? "" : `, ${kgFormat.format(performed.loadKg)} kg`}`,
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
function Badges({ grade }: { readonly grade: ItemGrade }) {
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
        <span className="text-xs text-muted-foreground">not recorded</span>
      ) : (
        <LevelBadge
          level={levelKey(grade.performed.level)}
          title={`Done at ${levelName(grade.performed.level)}`}
        >
          {levelName(grade.performed.level)}
        </LevelBadge>
      )}
    </>
  );
}

/** One protocol row's level: board to done, a small ruler, and any split of the reps. */
export function LevelLine({
  grade,
  nameOf,
}: {
  readonly grade: ItemGrade;
  readonly nameOf: (id: MovementId) => string | undefined;
}) {
  const note = shareNote(grade);
  const family = grade.performed?.family ?? grade.family;
  return (
    <span
      data-level-line
      className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-sm leading-6"
    >
      <span className="form-label text-muted-foreground">Level</span>
      <Badges grade={grade} />
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      <span className="ml-auto w-44">
        <LevelRuler
          size="sm"
          stops={familyStops(family)}
          markers={markersOf(grade, nameOf)}
          range={
            grade.prescribed && family.id === grade.family.id
              ? { from: grade.prescribed.position, to: grade.prescribed.position }
              : undefined
          }
          label={`${family.name}: board ${levelName(grade.prescribed?.level)}, done ${grade.performed ? levelName(grade.performed.level) : "not recorded"}.`}
        />
      </span>
    </span>
  );
}

/** The inspector's verdict: the family, board and done, the full ruler, and the rep split. */
export function LevelVerdict({
  grade,
  nameOf,
}: {
  readonly grade: ItemGrade;
  readonly nameOf: (id: MovementId) => string | undefined;
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
        <Badges grade={grade} />
      </span>
      <LevelRuler
        stops={familyStops(family)}
        markers={markersOf(grade, nameOf)}
        range={
          grade.prescribed && family.id === grade.family.id
            ? { from: grade.prescribed.position, to: grade.prescribed.position }
            : undefined
        }
        label={`${family.name}: board ${levelName(grade.prescribed?.level)}, done ${grade.performed ? levelName(grade.performed.level) : "not recorded"}.`}
      />
      {shares.length > 0 ? <LevelShareBar segments={segmentsOf(grade, shares)} /> : null}
      {family.id !== grade.family.id ? (
        <p className="text-xs text-muted-foreground">
          Done as another movement, so it is graded on {family.name}, not {grade.family.name}.
        </p>
      ) : null}
    </div>
  );
}
