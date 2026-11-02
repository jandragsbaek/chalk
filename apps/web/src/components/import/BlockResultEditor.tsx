import {
  BLOCK_RESULT_LABELS,
  cappedTotal,
  formatClock,
  parseClock,
  resultKindsFor,
  roundsOfBlock,
  stationCount,
  type BlockResult,
  type BlockResultKind,
  type DerivedBlock,
  type MovementId,
  type Sex,
  type SpanId,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { useId, useState, type KeyboardEvent } from "react";

interface Draft {
  readonly kind: BlockResultKind;
  readonly time: string;
  readonly round: number;
  readonly at: SpanId | undefined;
  readonly reps: string;
  readonly rounds: string;
}

const count = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : undefined);

const draftOf = (block: DerivedBlock, result: BlockResult | undefined): Draft => {
  const kinds = resultKindsFor(block.format);
  const empty: Draft = {
    kind: kinds[0] ?? "reps",
    time: "",
    round: roundsOfBlock(block.params),
    at: block.items.at(-1)?.spanId,
    reps: "",
    rounds: "",
  };
  // A result kind the format no longer takes starts over with the format's own.
  if (result === undefined || !kinds.includes(result._tag)) return empty;
  switch (result._tag) {
    case "time":
      return { ...empty, kind: "time", time: formatClock(result.seconds) };
    case "capped":
      return {
        ...empty,
        kind: "capped",
        round: result.round,
        at: result.at,
        reps: String(result.reps),
      };
    case "rounds_reps":
      return {
        ...empty,
        kind: "rounds_reps",
        rounds: String(result.rounds),
        reps: String(result.reps),
      };
    case "reps":
      return { ...empty, kind: "reps", reps: String(result.reps) };
  }
};

const resultOf = (draft: Draft, block: DerivedBlock, sex: Sex): BlockResult | undefined => {
  switch (draft.kind) {
    case "time": {
      const seconds = parseClock(draft.time);
      return seconds === undefined || seconds === 0 ? undefined : { _tag: "time", seconds };
    }
    case "capped": {
      const reps = count(draft.reps);
      if (draft.at === undefined || reps === undefined) return undefined;
      const stop = { round: draft.round, at: draft.at, reps };
      // Reps past the station's count belong to the next station.
      const station = block.items.find(
        (item) =>
          item.spanId === draft.at ||
          item.alternatives.some((alternative) => alternative.spanId === draft.at),
      );
      const asked =
        station === undefined
          ? undefined
          : stationCount(station, block.params, draft.round - 1, sex);
      if (asked !== undefined && reps > asked) return undefined;
      const total = cappedTotal(block, stop, sex);
      return total === undefined ? undefined : { _tag: "capped", ...stop, total };
    }
    case "rounds_reps": {
      const rounds = count(draft.rounds);
      const reps = draft.reps.trim() === "" ? 0 : count(draft.reps);
      return rounds === undefined || reps === undefined
        ? undefined
        : { _tag: "rounds_reps", rounds, reps };
    }
    case "reps": {
      const reps = count(draft.reps);
      return reps === undefined ? undefined : { _tag: "reps", reps };
    }
  }
};

/**
 * The athlete's score for one block, entered under its header: a time or where the cap came for
 * a for-time, rounds + reps for an AMRAP, reps otherwise. Every edit that makes a whole result
 * saves it; an incomplete one clears it, so the header box always shows what will be saved.
 */
export function BlockResultEditor({
  block,
  stored,
  nameOf,
  sex,
  onResult,
  onCap,
  onClose,
}: {
  readonly block: DerivedBlock;
  /** The result on the span as saved, even one that no longer fits the block. */
  readonly stored: BlockResult | undefined;
  readonly nameOf: (id: MovementId) => string | undefined;
  readonly sex: Sex;
  readonly onResult: (result: BlockResult | undefined) => void;
  /** Sets the block's time cap; absent when the cap is not the athlete's to set (a benchmark). */
  readonly onCap: ((seconds: number | undefined) => void) | undefined;
  readonly onClose: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => draftOf(block, stored));
  const [capText, setCapText] = useState(() =>
    block.params.timeCapSeconds === undefined ? "" : String(block.params.timeCapSeconds / 60),
  );
  const kinds = resultKindsFor(block.format);
  const rounds = roundsOfBlock(block.params);
  const cap = block.params.timeCapSeconds;

  function edit(next: Draft) {
    setDraft(next);
    const result = resultOf(next, block, sex);
    if (JSON.stringify(result) !== JSON.stringify(stored)) onResult(result);
  }

  function editCap(text: string) {
    setCapText(text);
    const minutes = Number(text.trim().replace(",", "."));
    onCap?.(text.trim() !== "" && minutes > 0 ? Math.round(minutes * 60) : undefined);
  }

  const closeOnKey = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const stationName = (index: number) => {
    const item = block.items[index]!;
    return (item.movementId === undefined ? undefined : nameOf(item.movementId)) ?? item.text;
  };
  const stopAt = block.items.findIndex(
    (item) =>
      item.spanId === draft.at ||
      item.alternatives.some((alternative) => alternative.spanId === draft.at),
  );
  const stopCount =
    stopAt === -1
      ? undefined
      : stationCount(block.items[stopAt]!, block.params, draft.round - 1, sex);
  const result = resultOf(draft, block, sex);
  const seconds = draft.kind === "time" ? parseClock(draft.time) : undefined;
  const repsValue = count(draft.reps);
  const repsTooMany =
    draft.kind === "capped" &&
    repsValue !== undefined &&
    stopCount !== undefined &&
    repsValue > stopCount;

  return (
    <div
      role="group"
      aria-label={`Score of ${block.title || "the block"}`}
      className="grid gap-3 border-b bg-card px-4 py-3"
      onKeyDown={closeOnKey}
    >
      <div className="flex flex-wrap items-end gap-3">
        {kinds.length > 1 ? (
          <div role="radiogroup" aria-label="How it ended" className="flex gap-1">
            {kinds.map((kind) => (
              <Button
                key={kind}
                role="radio"
                aria-checked={draft.kind === kind}
                variant={draft.kind === kind ? "default" : "outline"}
                size="sm"
                onClick={() => edit({ ...draft, kind })}
              >
                {kind === "time" ? "Finished" : BLOCK_RESULT_LABELS[kind]}
              </Button>
            ))}
          </div>
        ) : null}

        {draft.kind === "time" ? (
          <label className="grid gap-1">
            <span className="form-label text-muted-foreground">Time</span>
            <Input
              autoFocus
              inputMode="decimal"
              className="w-24"
              placeholder="12:34"
              aria-invalid={draft.time.trim() !== "" && seconds === undefined}
              value={draft.time}
              onChange={(event) => edit({ ...draft, time: event.target.value })}
            />
          </label>
        ) : null}

        {draft.kind === "capped" ? (
          <>
            {rounds > 1 ? (
              <label className="grid gap-1">
                <span className="form-label text-muted-foreground">Round</span>
                <NativeSelect
                  value={String(draft.round)}
                  onChange={(event) => edit({ ...draft, round: Number(event.target.value) })}
                >
                  {Array.from({ length: rounds }, (_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1} of {rounds}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : null}
            <label className="grid gap-1">
              <span className="form-label text-muted-foreground">Stopped at</span>
              <NativeSelect
                value={draft.at ?? ""}
                onChange={(event) => edit({ ...draft, at: event.target.value || undefined })}
              >
                {block.items.map((item, index) => {
                  const reps = stationCount(item, block.params, draft.round - 1, sex);
                  return (
                    <option key={item.spanId} value={item.spanId}>
                      {index + 1}. {reps === undefined ? "" : `${reps} `}
                      {stationName(index)}
                    </option>
                  );
                })}
              </NativeSelect>
            </label>
            <label className="grid gap-1">
              <span className="form-label text-muted-foreground">
                Reps done{stopCount === undefined ? "" : ` of ${stopCount}`}
              </span>
              <Input
                autoFocus
                inputMode="numeric"
                className="w-20"
                aria-invalid={repsTooMany}
                aria-describedby={repsTooMany ? `${id}-reps-hint` : undefined}
                value={draft.reps}
                onChange={(event) => edit({ ...draft, reps: event.target.value })}
              />
            </label>
          </>
        ) : null}

        {draft.kind === "rounds_reps" ? (
          <>
            <label className="grid gap-1">
              <span className="form-label text-muted-foreground">Rounds</span>
              <Input
                autoFocus
                inputMode="numeric"
                className="w-20"
                value={draft.rounds}
                onChange={(event) => edit({ ...draft, rounds: event.target.value })}
              />
            </label>
            <span className="pb-2 text-sm font-semibold">+</span>
            <label className="grid gap-1">
              <span className="form-label text-muted-foreground">Reps</span>
              <Input
                inputMode="numeric"
                className="w-20"
                placeholder="0"
                value={draft.reps}
                onChange={(event) => edit({ ...draft, reps: event.target.value })}
              />
            </label>
          </>
        ) : null}

        {draft.kind === "reps" ? (
          <label className="grid gap-1">
            <span className="form-label text-muted-foreground">Reps</span>
            <Input
              autoFocus
              inputMode="numeric"
              className="w-24"
              value={draft.reps}
              onChange={(event) => edit({ ...draft, reps: event.target.value })}
            />
          </label>
        ) : null}

        {block.format === "for_time" && onCap ? (
          <label className="grid gap-1">
            <span className="form-label text-muted-foreground">Cap min</span>
            <Input
              inputMode="decimal"
              className="w-20"
              aria-invalid={draft.kind === "capped" && cap === undefined}
              value={capText}
              onChange={(event) => editCap(event.target.value)}
            />
          </label>
        ) : null}

        <span className="ml-auto flex gap-1">
          {stored === undefined ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onResult(undefined);
                setDraft({
                  ...draftOf(block, undefined),
                  ...(kinds.includes(draft.kind) ? { kind: draft.kind } : {}),
                });
              }}
            >
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </span>
      </div>

      <p id={`${id}-reps-hint`} className="text-xs text-muted-foreground">
        {draft.kind === "capped"
          ? repsTooMany
            ? `More than the station's ${stopCount}: you were on the next one.`
            : result?._tag === "capped"
              ? `${result.total} reps by the cap${cap === undefined ? "" : ` of ${formatClock(cap)}`}: every station before ${stopAt + 1}. ${stationName(stopAt)}${rounds > 1 ? ` in round ${draft.round}` : ""} in full, then ${result.reps} of it.${cap === undefined ? " Add the cap to time it." : ""}`
              : "Pick the station the cap came in and how many reps of it you got."
          : draft.kind === "time"
            ? seconds !== undefined && cap !== undefined && seconds > cap
              ? `Over the ${formatClock(cap)} cap: capped instead?`
              : "mm:ss, or whole minutes."
            : draft.kind === "rounds_reps"
              ? "Full rounds, then the reps into the next."
              : "Every rep of the block."}
      </p>
    </div>
  );
}
