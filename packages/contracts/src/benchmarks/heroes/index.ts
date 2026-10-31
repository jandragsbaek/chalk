import type { Benchmark } from "../model.ts";
import { HEROES_1 } from "./part1.ts";
import { HEROES_2 } from "./part2.ts";
import { HEROES_3 } from "./part3.ts";
import { HEROES_4 } from "./part4.ts";

/** CrossFit's Hero and tribute workouts, in the order the official list posts them. */
export const HEROES: ReadonlyArray<Benchmark> = [
  ...HEROES_1,
  ...HEROES_2,
  ...HEROES_3,
  ...HEROES_4,
];
