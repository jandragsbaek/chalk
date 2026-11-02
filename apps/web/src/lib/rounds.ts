import { formatAmount, type Amount } from "@chalk/contracts";

/**
 * An EMOM or every-X station logged round by round: what was reached each time it came round,
 * against the athlete's own aim ("7-8 burpees"). A round is on aim when it reached the aim's low
 * end.
 */

export const onAim = (count: number, aim: Amount): boolean => count >= aim.min;

export const roundsOnAim = (rounds: ReadonlyArray<number>, aim: Amount): number =>
  rounds.filter((count) => onAim(count, aim)).length;

/** The range the rounds span, worst to best: the performance's `perRound`. */
export const spanOfRounds = (rounds: ReadonlyArray<number>): Amount => ({
  min: Math.min(...rounds),
  max: Math.max(...rounds),
});

/** "8 · 8 · 7 · 6 reps". */
export const describeRounds = (rounds: ReadonlyArray<number>, unit: string | undefined): string =>
  `${rounds.join(" · ")}${unit === undefined ? "" : ` ${unit}`}`;

/** "3 of 4 rounds on aim (7-8)". */
export const describeOnAim = (rounds: ReadonlyArray<number>, aim: Amount): string =>
  `${roundsOnAim(rounds, aim)} of ${rounds.length} rounds on aim (${formatAmount(aim)})`;
