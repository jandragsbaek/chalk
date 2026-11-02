import {
  tonnageOf,
  type Amount,
  type DerivedItem,
  type Quantity,
  type Sex,
} from "@chalk/contracts";

/**
 * A load the athlete changed from the board's, like a changed attempt on a meet protocol: the
 * board's number struck, the one used written beside it.
 */
export interface LoadChange {
  /** The heaviest load the board wrote, on the athlete's side of an M/F split. */
  readonly boardKg: number;
  readonly doneKg: number;
}

/** The athlete's side of a load: "@70.25/47.75" is 47.75 for a woman. */
export const loadSide = (quantity: Quantity, sex: Sex): Amount =>
  sex === "f" && quantity.female !== undefined ? quantity.female : quantity.amount;

/** Written loads a change can strike: not a level's tier, which says its own load. */
const boardLoads = (item: DerivedItem) =>
  item.sets.flatMap((set) =>
    set.quantities.filter((quantity) => quantity.measure === "load_kg" && !quantity.tiers?.length),
  );

const within = (amount: Amount, kg: number) => amount.min <= kg && kg <= amount.max;

/**
 * The board's load against the one the athlete said they used; none when they used a load the
 * board wrote (any of its sets, anywhere in a written range) or the board wrote none.
 */
export const loadChangeOf = (item: DerivedItem, sex: Sex): LoadChange | undefined => {
  const doneKg = item.performance?.loadKg;
  const amounts = boardLoads(item).map((quantity) => loadSide(quantity, sex));
  if (doneKg === undefined || amounts.length === 0) return undefined;
  if (amounts.some((amount) => within(amount, doneKg))) return undefined;
  const boardKg = Math.max(...amounts.map((amount) => amount.max));
  return boardKg === 0 ? undefined : { boardKg, doneKg };
};

/** Whether `quantity` is a board load the change strikes. */
export const isStruck = (quantity: Quantity, change: LoadChange, sex: Sex) =>
  quantity.measure === "load_kg" &&
  !quantity.tiers?.length &&
  !within(loadSide(quantity, sex), change.doneKg);

/** "71 % of board": the load used as a share of the board's. */
export const shareOfBoard = (doneKg: number, boardKg: number) =>
  Math.round((doneKg / boardKg) * 100);

/**
 * What the items would have lifted at the board's loads, for the same reps: the sets done at a
 * changed load count at the board's instead. `undefined` when no load was changed.
 */
export const boardTonnageOf = (items: ReadonlyArray<DerivedItem>, sex: Sex): number | undefined => {
  let changed = false;
  const tonnage = (item: DerivedItem): number => {
    const change = loadChangeOf(item, sex);
    if (change !== undefined && item.performed.length > 0) changed = true;
    // A set of a pair lifts both bells: its load is the one per implement, twice.
    const pair = item.performance?.implements ?? 1;
    const sets =
      change === undefined
        ? item.performed
        : item.performed.map((set) =>
            set.loadKg === change.doneKg * pair ? { ...set, loadKg: change.boardKg * pair } : set,
          );
    return tonnageOf(sets) + item.alternatives.reduce((sum, option) => sum + tonnage(option), 0);
  };
  const total = items.reduce((sum, item) => sum + tonnage(item), 0);
  return changed && total > 0 ? Math.round(total * 100) / 100 : undefined;
};
