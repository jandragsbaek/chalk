import {
  LogLiftSetInput,
  MovementId,
  THE_BOX,
  type Movement,
  type MovementCategory,
  type Place,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Label, NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { useState } from "react";

import { formatKg, MOVEMENT_CATEGORY_LABELS } from "../lib/strength.ts";
import { localIsoDate } from "../lib/utils.ts";
import { LIFTS_REACTIVITY_KEY, logLiftSetAtom, movementsAtom } from "../state/strength.ts";
import { PlaceField } from "./PlaceField.tsx";

const decodeLogLiftSetInput = Schema.decodeUnknownOption(LogLiftSetInput);

const DEFAULT_MOVEMENT = MovementId.make("back-squat");

function groupByCategory(movements: ReadonlyArray<Movement>) {
  const groups = new Map<MovementCategory, Movement[]>();
  for (const movement of movements) {
    const group = groups.get(movement.category);
    if (group) group.push(movement);
    else groups.set(movement.category, [movement]);
  }
  return [...groups];
}

type SubmitStatus =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "saved"; readonly message: string }
  | { readonly type: "error"; readonly message: string };

export function LogLiftSetForm() {
  const movements = AsyncResult.getOrElse(useAtomValue(movementsAtom), () => []);
  const logLiftSet = useAtomSet(logLiftSetAtom, { mode: "promiseExit" });
  const [movementId, setMovementId] = useState<string>(DEFAULT_MOVEMENT);
  const [performedOn, setPerformedOn] = useState(() => localIsoDate(new Date()));
  const [reps, setReps] = useState("5");
  const [loadKg, setLoadKg] = useState("");
  const [notes, setNotes] = useState("");
  const [place, setPlace] = useState<Place>(THE_BOX);
  const [status, setStatus] = useState<SubmitStatus>({ type: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = decodeLogLiftSetInput({
      movementId,
      performedOn,
      reps: Number(reps),
      loadKg: Number(loadKg.replace(",", ".")),
      notes: notes.trim(),
      ...(place._tag === "box" ? {} : { place }),
    });
    if (Option.isNone(input)) {
      setStatus({ type: "error", message: "Pick a movement, whole reps and a load above 0 kg." });
      return;
    }

    setStatus({ type: "saving" });
    const exit = await logLiftSet({
      payload: input.value,
      reactivityKeys: [LIFTS_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) {
      setStatus({ type: "error", message: "Could not save the set. Try again." });
      return;
    }
    // Movement, reps and load stay put: the next set is usually the same lift.
    setNotes("");
    setStatus({
      type: "saved",
      message: `Saved ${input.value.reps} × ${formatKg(input.value.loadKg)}.`,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="lift-movement">Movement</Label>
        <NativeSelect
          id="lift-movement"
          value={movementId}
          onChange={(event) => setMovementId(event.target.value)}
        >
          {groupByCategory(movements).map(([category, categoryMovements]) => (
            <optgroup key={category} label={MOVEMENT_CATEGORY_LABELS[category]}>
              {categoryMovements.map((movement) => (
                <option key={movement.id} value={movement.id}>
                  {movement.name}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lift-reps">Reps</Label>
        <Input
          id="lift-reps"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={reps}
          onChange={(event) => setReps(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lift-load">Load (kg)</Label>
        <Input
          id="lift-load"
          inputMode="decimal"
          placeholder="100"
          autoComplete="off"
          value={loadKg}
          onChange={(event) => setLoadKg(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lift-date">Date</Label>
        <Input
          id="lift-date"
          type="date"
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lift-place">Place</Label>
        <PlaceField id="lift-place" place={place} onChange={setPlace} />
      </div>

      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="lift-notes">Notes</Label>
        <Input
          id="lift-notes"
          placeholder="Belt, felt fast, RPE 8..."
          autoComplete="off"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p
          role="status"
          className={
            status.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {status.type === "error" || status.type === "saved" ? status.message : null}
        </p>
        <Button type="submit" disabled={status.type === "saving"}>
          {status.type === "saving" ? "Saving..." : "Log set"}
        </Button>
      </div>
    </form>
  );
}
