import {
  REP_MAX_TARGETS,
  type LiftSet,
  type MovementId,
  type MovementRecords,
  type RepMax,
} from "@chalk/contracts";

/** Heavier wins; on equal load the earlier set wins, since that is when the record was set. */
const beats = (candidate: LiftSet, best: LiftSet) =>
  candidate.loadKg > best.loadKg ||
  (candidate.loadKg === best.loadKg && candidate.performedOn < best.performedOn);

/**
 * Rep maxes per movement: for each target in `REP_MAX_TARGETS`, the heaviest set of at least
 * that many reps. Movements are ordered by id; targets no set reaches are left out.
 */
export function computeRecords(sets: ReadonlyArray<LiftSet>): ReadonlyArray<MovementRecords> {
  const byMovement = new Map<MovementId, LiftSet[]>();
  for (const set of sets) {
    const movementSets = byMovement.get(set.movementId);
    if (movementSets) movementSets.push(set);
    else byMovement.set(set.movementId, [set]);
  }

  return [...byMovement]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([movementId, movementSets]) => {
      const repMaxes: RepMax[] = [];
      for (const reps of REP_MAX_TARGETS) {
        let best: LiftSet | undefined;
        for (const set of movementSets) {
          if (set.reps >= reps && (best === undefined || beats(set, best))) best = set;
        }
        if (best) {
          repMaxes.push({
            reps,
            loadKg: best.loadKg,
            fromReps: best.reps,
            performedOn: best.performedOn,
            liftSetId: best.id,
          });
        }
      }
      return { movementId, repMaxes };
    });
}
