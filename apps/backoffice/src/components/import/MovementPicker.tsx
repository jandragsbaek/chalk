import {
  MovementCategory,
  normalizeMovementPhrase,
  type CatalogMovement,
  type MovementId,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Label, NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CATALOG_REACTIVITY_KEY, addAliasAtom, createMovementAtom } from "../../state/imports.ts";

export const CATEGORY_LABELS: Record<MovementCategory, string> = {
  barbell: "Barbell",
  dumbbell_kettlebell: "Dumbbell / kettlebell",
  gymnastics: "Gymnastics",
  monostructural: "Monostructural",
  other: "Other",
};

const sentenceCase = (phrase: string) => {
  const trimmed = phrase.trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

/** Core movements first, each followed by its variations: Snatch, Hang power snatch, Power snatch. */
export const byFamily = (catalog: ReadonlyArray<CatalogMovement>) => {
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const familyOf = (movement: CatalogMovement) =>
    (movement.variationOf === undefined ? undefined : names.get(movement.variationOf)) ??
    movement.name;
  return [...catalog].sort(
    (left, right) =>
      familyOf(left).localeCompare(familyOf(right)) ||
      Number(left.variationOf !== undefined) - Number(right.variationOf !== undefined) ||
      left.name.localeCompare(right.name),
  );
};

/** Core movements a new movement can be a variation of. */
export const coreMovements = (catalog: ReadonlyArray<CatalogMovement>) =>
  catalog
    .filter((movement) => movement.variationOf === undefined)
    .sort((left, right) => left.name.localeCompare(right.name));

/** The core whose name the phrase ends in or contains, longest first: "High-hang power snatch" → Snatch. */
export const guessCore = (
  phrase: string,
  catalog: ReadonlyArray<CatalogMovement>,
): CatalogMovement | undefined => {
  const words = ` ${normalizeMovementPhrase(phrase)} `;
  return coreMovements(catalog)
    .filter((movement) => {
      const name = normalizeMovementPhrase(movement.name);
      return words.includes(` ${name} `) && words.trim() !== name;
    })
    .sort((left, right) => right.name.length - left.name.length)[0];
};

const matches = (movement: CatalogMovement, query: string) => {
  const key = normalizeMovementPhrase(query);
  if (key === "") return true;
  return [movement.name, ...movement.aliases].some((phrase) =>
    key.split(" ").every((word) => normalizeMovementPhrase(phrase).includes(word)),
  );
};

/**
 * Pick the catalog movement a highlighted phrase means. Picking can teach the catalog the phrase
 * as an alias, and a missing movement can be created on the spot.
 */
export function MovementPicker({
  phrase,
  catalog,
  value,
  onPick,
}: {
  readonly phrase: string;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly value: MovementId | undefined;
  /** `learned` is true when the phrase is now an alias, so other occurrences can be re-tagged. */
  readonly onPick: (movementId: MovementId, learned: boolean) => void;
}) {
  const [query, setQuery] = useState(phrase);
  const [remember, setRemember] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(() => sentenceCase(phrase));
  const [variationOf, setVariationOf] = useState(() => guessCore(phrase, catalog)?.id);
  const [category, setCategory] = useState<MovementCategory>(
    () => guessCore(phrase, catalog)?.category ?? "other",
  );
  const [error, setError] = useState<string | undefined>();
  const createMovement = useAtomSet(createMovementAtom, { mode: "promiseExit" });
  const addAlias = useAtomSet(addAliasAtom, { mode: "promiseExit" });

  const phraseKey = normalizeMovementPhrase(phrase);
  const isKnownPhrase = (movement: CatalogMovement) =>
    [movement.name, ...movement.aliases].some(
      (known) => normalizeMovementPhrase(known) === phraseKey,
    );
  const nameOf = (id: MovementId | undefined) =>
    id === undefined ? undefined : catalog.find((movement) => movement.id === id)?.name;
  const candidates = byFamily(catalog.filter((movement) => matches(movement, query))).slice(0, 8);
  const shown = new Set(candidates.map((movement) => movement.id));

  async function handlePick(movement: CatalogMovement) {
    setError(undefined);
    if (!remember || isKnownPhrase(movement)) {
      onPick(movement.id, false);
      return;
    }
    const exit = await addAlias({
      params: { id: movement.id },
      payload: { alias: phrase.trim() },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) {
      onPick(movement.id, true);
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure) && failure.value._tag === "AliasTakenError") {
      setError(
        `"${phrase.trim()}" already means ${failure.value.movementId}. Picked without saving it.`,
      );
      onPick(movement.id, false);
      return;
    }
    setError("Could not save the alias. The movement is picked for this session only.");
    onPick(movement.id, false);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const trimmed = name.trim();
    if (trimmed === "") return;
    const aliases = normalizeMovementPhrase(trimmed) === phraseKey ? [] : [phrase.trim()];
    const exit = await createMovement({
      payload: {
        name: trimmed,
        category,
        aliases,
        ...(variationOf === undefined ? {} : { variationOf }),
      },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) {
      setCreating(false);
      onPick(exit.value.id, true);
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    setError(
      Option.isSome(failure) && failure.value._tag === "MovementExistsError"
        ? `${failure.value.name} already exists. Pick it from the list.`
        : Option.isSome(failure) && failure.value._tag === "AliasTakenError"
          ? `"${failure.value.alias}" already means ${failure.value.movementId}.`
          : Option.isSome(failure) && failure.value._tag === "VariationInvalidError"
            ? failure.value.message
            : "Could not create the movement.",
    );
  }

  return (
    <div className="grid gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search movements"
        aria-label="Search movements"
        autoFocus
      />
      <ul
        className="grid max-h-72 divide-y overflow-y-auto border bg-card"
        aria-label="Matching movements"
      >
        {candidates.map((movement) => (
          <li key={movement.id}>
            <button
              type="button"
              data-current={movement.id === value ? "" : undefined}
              data-picker-option
              className={
                movement.variationOf !== undefined && shown.has(movement.variationOf)
                  ? "flex w-full cursor-pointer items-baseline justify-between gap-3 py-1.5 pl-6 pr-2.5 text-left text-sm hover:bg-muted"
                  : "flex w-full cursor-pointer items-baseline justify-between gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              }
              onClick={() => void handlePick(movement)}
            >
              <span className="font-semibold">{movement.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {[
                  movement.variationOf === undefined
                    ? undefined
                    : `${nameOf(movement.variationOf)} variation`,
                  movement.aliases.length > 0 ? movement.aliases.join(", ") : undefined,
                ]
                  .filter((part) => part !== undefined)
                  .join(" · ") || CATEGORY_LABELS[movement.category]}
              </span>
            </button>
          </li>
        ))}
        {candidates.length === 0 ? (
          <li className="px-2.5 py-2 text-sm text-muted-foreground">
            No movement matches. Create it below.
          </li>
        ) : null}
      </ul>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 accent-foreground"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Remember "{phrase.trim()}" for the next sessions
      </label>
      {creating ? (
        <form
          className="grid gap-2 border bg-muted p-3"
          onSubmit={(event) => void handleCreate(event)}
        >
          <Label htmlFor="new-movement-name">New movement</Label>
          <Input
            id="new-movement-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <NativeSelect
            value={variationOf ?? ""}
            aria-label="Variation of"
            onChange={(event) => {
              const core = catalog.find((movement) => movement.id === event.target.value);
              setVariationOf(core?.id);
              if (core) setCategory(core.category);
            }}
          >
            <option value="">Core movement (no variation)</option>
            {coreMovements(catalog).map((core) => (
              <option key={core.id} value={core.id}>
                Variation of {core.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={category}
            aria-label="Category"
            onChange={(event) => setCategory(event.target.value as MovementCategory)}
          >
            {MovementCategory.literals.map((option) => (
              <option key={option} value={option}>
                {CATEGORY_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Create and pick
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus />
          New movement "{sentenceCase(phrase)}"
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
