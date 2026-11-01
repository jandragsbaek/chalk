import {
  makeMovementMatcher,
  normalizeMovementPhrase,
  normalizeToken,
  variationLadder,
  type CatalogMovement,
  type MovementId,
  type SpanOf,
  type TrailingWords,
  type VariationOption,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { ArrowRight } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { isTyping } from "../../lib/utils.ts";
import { addAliasAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";

/** Keys 1 to 8 pick a variation; 0 keeps the mark's own movement. */
const MAX_RUNGS = 8;

/** The name with the words the leftovers matched in bold: Burpee **over line**. */
function MatchedName({ option }: { readonly option: VariationOption }) {
  const name = option.movement.name;
  const parts = Array.from(name.matchAll(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu), (match) => ({
    text: match[0],
    at: match.index,
  }));
  return (
    <span className="min-w-0 truncate">
      {parts.map((part) =>
        option.matched.has(normalizeToken(part.text)) ? (
          <b key={part.at} data-match>
            {part.text}
          </b>
        ) : (
          <span key={part.at}>{part.text}</span>
        ),
      )}
    </span>
  );
}

interface Learned {
  readonly phrase: string;
  readonly name: string;
  /** Other lines the phrase is on, re-tagged with it. */
  readonly others: number;
  readonly saved: boolean;
  readonly error?: string;
}

/**
 * The words a mark left over ("o. line" after "Burpee") as a choice between the core movement's
 * variations, best match first, picked with a click or keys 1 to 8 (0 keeps the movement). The
 * pick takes in the words and teaches the catalog the whole phrase, so other lines with it are
 * re-tagged and the next session reads it. Then a receipt says what was learned.
 */
export function VariationLadder({
  span,
  text,
  tail,
  catalog,
  onPicked,
}: {
  readonly span: SpanOf<"movement">;
  readonly text: string;
  readonly tail: TrailingWords | undefined;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  /**
   * The mark runs on to `end` as `movementId`, or opens for a pick when `undefined`. `learned`
   * when the phrase is now an alias, so other occurrences can be re-tagged.
   */
  readonly onPicked: (movementId: MovementId | undefined, end: number, learned: boolean) => void;
}) {
  const [learned, setLearned] = useState<Learned | undefined>();
  const [busy, setBusy] = useState(false);
  const addAlias = useAtomSet(addAliasAtom, { mode: "promiseExit" });
  const own = catalog.find((movement) => movement.id === span.movementId);
  const ladder =
    tail === undefined || span.movementId === undefined
      ? undefined
      : variationLadder(span.movementId, catalog, tail.text);
  const rungs = ladder?.options.slice(0, MAX_RUNGS) ?? [];
  // Best fit only when one rung matched more of the words than any other.
  const [first, second] = rungs;
  const best =
    first !== undefined && first.score > 0 && first.score > (second?.score ?? 0)
      ? first
      : undefined;

  async function pick(movement: CatalogMovement) {
    if (tail === undefined || busy) return;
    const phrase = text.slice(span.start, tail.end);
    const others = Math.max(
      0,
      makeMovementMatcher([{ id: movement.id, name: phrase, aliases: [] }]).find(text).length - 1,
    );
    const known = [movement.name, ...movement.aliases].some(
      (known) => normalizeMovementPhrase(known) === normalizeMovementPhrase(phrase),
    );
    if (known) {
      setLearned({ phrase, name: movement.name, others, saved: true });
      onPicked(movement.id, tail.end, true);
      return;
    }
    setBusy(true);
    const exit = await addAlias({
      params: { id: movement.id },
      payload: { alias: phrase.trim() },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    setBusy(false);
    if (Exit.isSuccess(exit)) {
      setLearned({ phrase, name: movement.name, others, saved: true });
      onPicked(movement.id, tail.end, true);
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    const taken = Option.isSome(failure) && failure.value._tag === "AliasTakenError";
    setLearned({
      phrase,
      name: movement.name,
      others: 0,
      saved: false,
      error: taken
        ? `"${phrase}" already means another movement, so it is picked here without saving it.`
        : "Could not save the phrase. It is picked here only.",
    });
    onPicked(movement.id, tail.end, false);
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (ladder === undefined || isTyping(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (!/^[0-9]$/.test(event.key)) return;
    const digit = Number(event.key);
    const movement = digit === 0 ? own : rungs[digit - 1]?.movement;
    if (movement === undefined) return;
    event.preventDefault();
    void pick(movement);
  });
  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- window keydown listener for the ladder's digit keys while it is mounted
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Mounted before the receipt is, so screen readers announce it.
  const live = (
    <div aria-live="polite" className="contents">
      {learned !== undefined && ladder === undefined ? <Receipt learned={learned} /> : null}
    </div>
  );
  if (ladder === undefined || tail === undefined || own === undefined)
    return (
      <>
        {null}
        {live}
      </>
    );

  return (
    <>
      <section aria-label="Variation" data-ladder className="grid min-w-0 gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="form-label text-muted-foreground">Variation</span>
          <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">left over</span>
            <span data-tail className="truncate font-mono text-sm font-bold text-foreground">
              {tail.text}
            </span>
          </span>
        </div>
        <ol className="grid min-w-0 border-y" aria-label={`Variations of ${ladder.core.name}`}>
          {rungs.map((option, at) => (
            <li key={option.movement.id} className="min-w-0 border-b last:border-b-0">
              <button
                type="button"
                data-rung
                data-best={option === best ? "" : undefined}
                aria-keyshortcuts={String(at + 1)}
                disabled={busy}
                className="flex w-full cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left text-sm"
                onClick={() => void pick(option.movement)}
              >
                <kbd data-key>{at + 1}</kbd>
                <span className="grid min-w-0 flex-1 leading-5">
                  <MatchedName option={option} />
                  {option.via === undefined ? null : (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      as {option.via}
                    </span>
                  )}
                </span>
                {option === best ? (
                  <span className="form-label shrink-0 text-muted-foreground">Best fit</span>
                ) : null}
              </button>
            </li>
          ))}
          <li className="border-t border-dashed">
            <button
              type="button"
              data-rung
              aria-keyshortcuts="0"
              disabled={busy}
              className="flex w-full cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left text-sm text-muted-foreground"
              onClick={() => void pick(own)}
            >
              <kbd data-key>0</kbd>
              <span className="min-w-0 truncate">
                Just <span className="font-medium text-foreground">{own.name}</span>
              </span>
            </button>
          </li>
        </ol>
        <div className="grid justify-items-start gap-1">
          <p className="text-xs text-muted-foreground">
            The pick learns{" "}
            <span className="font-mono font-bold text-foreground">
              {text.slice(span.start, tail.end)}
            </span>{" "}
            for the next session too.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3"
            disabled={busy}
            onClick={() => onPicked(undefined, tail.end, false)}
          >
            None of these: pick or create one
          </Button>
        </div>
      </section>
      {live}
    </>
  );
}

/** What the last pick taught: the phrase, the movement, and the other lines it re-tagged. */
function Receipt({ learned }: { readonly learned: Learned }) {
  return (
    <section
      aria-label="Learned"
      data-receipt
      data-unsaved={learned.saved ? undefined : ""}
      className="grid gap-1 px-3 py-2"
    >
      <span className="form-label text-muted-foreground">
        {learned.saved ? "Learned" : "Picked, not learned"}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
        <span className="font-mono font-bold">{learned.phrase}</span>
        <ArrowRight aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">means</span>
        <span className="font-semibold">{learned.name}</span>
      </span>
      {learned.error ? (
        <span className="text-xs text-muted-foreground">{learned.error}</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {learned.others === 0
            ? "Read this way from the next session on."
            : `Re-tagged ${learned.others} more ${learned.others === 1 ? "line" : "lines"}, and read this way from the next session on.`}
        </span>
      )}
    </section>
  );
}

/**
 * Without words left over: the other movements of the mark's family as one-click swaps (the box
 * wrote "Burpee" but meant the bar-facing one). The first few, the rest on request.
 */
export function VariationSwaps({
  movementId,
  catalog,
  onPick,
}: {
  readonly movementId: MovementId;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly onPick: (movementId: MovementId) => void;
}) {
  const [all, setAll] = useState(false);
  const ladder = variationLadder(movementId, catalog, undefined);
  if (ladder === undefined) return null;
  const SHOWN = 5;
  const shown = all ? ladder.options : ladder.options.slice(0, SHOWN);
  const hidden = ladder.options.length - shown.length;
  return (
    <div className="grid gap-1">
      <span className="form-label text-muted-foreground">
        {movementId === ladder.core.id ? "Variations" : `Also ${ladder.core.name}`}
      </span>
      <div role="group" aria-label="Variations" className="flex flex-wrap gap-1">
        {shown.map((option) => (
          <Button
            key={option.movement.id}
            size="sm"
            variant="outline"
            onClick={() => onPick(option.movement.id)}
          >
            {option.movement.name}
          </Button>
        ))}
        {hidden > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
            {hidden} more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
