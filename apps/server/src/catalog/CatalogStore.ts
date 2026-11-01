import {
  AliasTakenError,
  CatalogMovement,
  CatalogNotFoundError,
  Complement,
  LevelFamilyId,
  MovementCategory,
  MovementExistsError,
  MovementId,
  normalizeMovementPhrase,
  TrimmedNonEmptyString,
  VariationInvalidError,
  type CreateMovementInput,
  type SetMovementLevelsInput,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class CatalogPersistenceError extends Schema.TaggedError<CatalogPersistenceError>()(
  "CatalogPersistenceError",
  {
    operation: Schema.Literals([
      "list the catalog",
      "create a movement",
      "add an alias",
      "set a core movement",
      "set a movement's levels",
      "set a movement's scalings",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

/** "Dual KB front rack carry" → "dual-kb-front-rack-carry". */
export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "movement";

const MovementRow = Schema.Struct({
  id: MovementId,
  name: TrimmedNonEmptyString,
  category: MovementCategory,
  variationOf: Schema.NullOr(MovementId),
  levelFamily: Schema.NullOr(LevelFamilyId),
  accessory: Schema.Number,
  complements: Schema.fromJsonString(Schema.Array(Complement)),
  supports: Schema.fromJsonString(Schema.Array(LevelFamilyId)),
  scalings: Schema.fromJsonString(Schema.Array(MovementId)),
});
type MovementRow = typeof MovementRow.Type;

const AliasRow = Schema.Struct({
  key: Schema.String,
  alias: Schema.String,
  movementId: MovementId,
});

export class CatalogStore extends Context.Service<
  CatalogStore,
  {
    /** Every movement with its aliases, by category then name. */
    readonly list: () => Effect.Effect<ReadonlyArray<CatalogMovement>, CatalogPersistenceError>;
    /**
     * A user-added movement; its id is the slug of its name. Its name takes over the phrase
     * from any alias that meant another movement ("Squat snatch" stops meaning Snatch).
     */
    readonly create: (
      input: CreateMovementInput,
    ) => Effect.Effect<
      CatalogMovement,
      | MovementExistsError
      | AliasTakenError
      | CatalogNotFoundError
      | VariationInvalidError
      | CatalogPersistenceError
    >;
    /** Teaches the matcher another phrase for a movement; repeating one is a no-op. */
    readonly addAlias: (
      id: MovementId,
      alias: string,
    ) => Effect.Effect<
      CatalogMovement,
      CatalogNotFoundError | AliasTakenError | CatalogPersistenceError
    >;
    /** Makes `id` a variation of the core `variationOf`, or a core again with `null`. */
    readonly setVariationOf: (
      id: MovementId,
      variationOf: MovementId | null,
    ) => Effect.Effect<
      CatalogMovement,
      CatalogNotFoundError | VariationInvalidError | CatalogPersistenceError
    >;
    /** The sheet row a movement is graded on, and whether it is an accessory and for what. */
    readonly setLevels: (
      id: MovementId,
      input: SetMovementLevelsInput,
    ) => Effect.Effect<CatalogMovement, CatalogNotFoundError | CatalogPersistenceError>;
    /**
     * The movements `id` scales to, first offered first; itself and repeats are dropped. Fails
     * with `CatalogNotFoundError` for `id` or a scaling not in the catalog.
     */
    readonly setScalings: (
      id: MovementId,
      scalings: ReadonlyArray<MovementId>,
    ) => Effect.Effect<CatalogMovement, CatalogNotFoundError | CatalogPersistenceError>;
  }
>()("chalk/catalog/CatalogStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectMovements = SqlSchema.findAll({
    Request: Schema.Void,
    Result: MovementRow,
    execute: () =>
      sql`
        SELECT id, name, category, variation_of AS "variationOf", level_family AS "levelFamily",
               accessory, complements, supports, scalings
        FROM movements ORDER BY category, name
      `,
  });

  const selectAliases = SqlSchema.findAll({
    Request: Schema.Void,
    Result: AliasRow,
    execute: () =>
      sql`SELECT key, alias, movement_id AS "movementId" FROM movement_aliases ORDER BY alias`,
  });

  const loadAll = Effect.gen(function* () {
    const movements = yield* selectMovements(undefined);
    const aliases = yield* selectAliases(undefined);
    return { movements, aliases };
  });

  const toCatalog = (
    movements: ReadonlyArray<MovementRow>,
    aliases: ReadonlyArray<typeof AliasRow.Type>,
  ): ReadonlyArray<CatalogMovement> =>
    movements.map(
      ({ variationOf, levelFamily, accessory, complements, supports, scalings, ...movement }) => ({
        ...movement,
        aliases: aliases.filter((row) => row.movementId === movement.id).map((row) => row.alias),
        ...(variationOf === null ? {} : { variationOf }),
        ...(levelFamily === null ? {} : { levelFamily }),
        ...(accessory === 1 ? { accessory: true } : {}),
        ...(complements.length === 0 ? {} : { complements }),
        ...(supports.length === 0 ? {} : { supports }),
        ...(scalings.length === 0 ? {} : { scalings }),
      }),
    );

  /** Fails unless `variationOf` is a core movement that `id` can hang under. */
  const checkVariation = Effect.fn("CatalogStore.checkVariation")(function* (
    movements: ReadonlyArray<MovementRow>,
    id: MovementId,
    variationOf: MovementId,
  ) {
    const core = movements.find((movement) => movement.id === variationOf);
    if (!core) return yield* new CatalogNotFoundError({ id: variationOf });
    const invalid = (reason: VariationInvalidError["reason"]) =>
      new VariationInvalidError({ id, variationOf, reason });
    if (variationOf === id) return yield* invalid("self");
    if (core.variationOf !== null) return yield* invalid("core-is-variation");
    if (movements.some((movement) => movement.variationOf === id))
      return yield* invalid("has-variations");
  });

  /** Inserts `alias` for `movement` unless it already means it; fails when it means another. */
  const insertAlias = Effect.fn("CatalogStore.insertAlias")(function* (
    movement: { readonly id: MovementId; readonly name: string },
    alias: string,
  ) {
    const key = normalizeMovementPhrase(alias);
    if (key === "" || key === normalizeMovementPhrase(movement.name)) return;
    const { movements, aliases } = yield* loadAll;
    const named = movements.find((other) => normalizeMovementPhrase(other.name) === key);
    if (named) return yield* new AliasTakenError({ alias, movementId: named.id });
    const existing = aliases.find((row) => row.key === key);
    if (existing?.movementId === movement.id) return;
    if (existing) return yield* new AliasTakenError({ alias, movementId: existing.movementId });
    yield* sql`
      INSERT INTO movement_aliases (key, alias, movement_id)
      VALUES (${key}, ${alias.trim()}, ${movement.id})
    `;
  });

  const catalogEntry = Effect.fn("CatalogStore.catalogEntry")(function* (id: MovementId) {
    const { movements, aliases } = yield* loadAll;
    return toCatalog(movements, aliases).find((movement) => movement.id === id);
  });

  const list = Effect.fn("CatalogStore.list")(function* () {
    const { movements, aliases } = yield* loadAll.pipe(
      Effect.mapError(
        (cause) => new CatalogPersistenceError({ operation: "list the catalog", cause }),
      ),
    );
    return toCatalog(movements, aliases);
  });

  const create = Effect.fn("CatalogStore.create")(
    function* (input: CreateMovementInput) {
      const id = MovementId.make(slugify(input.name));
      const nameKey = normalizeMovementPhrase(input.name);
      const created = yield* Effect.gen(function* () {
        const { movements } = yield* loadAll;
        const taken = movements.find(
          (other) => other.id === id || normalizeMovementPhrase(other.name) === nameKey,
        );
        if (taken) return yield* new MovementExistsError({ id: taken.id, name: taken.name });
        if (input.variationOf !== undefined)
          yield* checkVariation(movements, id, input.variationOf);
        yield* sql`DELETE FROM movement_aliases WHERE key = ${nameKey}`;
        yield* sql`
          INSERT INTO movements (id, name, category, user_added, variation_of)
          VALUES (${id}, ${input.name}, ${input.category}, 1, ${input.variationOf ?? null})
        `;
        for (const alias of input.aliases) yield* insertAlias({ id, name: input.name }, alias);
        return yield* catalogEntry(id);
      }).pipe(sql.withTransaction);
      return (
        created ?? {
          id,
          name: input.name,
          category: input.category,
          aliases: [],
          ...(input.variationOf === undefined ? {} : { variationOf: input.variationOf }),
        }
      );
    },
    Effect.catchTags({
      SqlError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "create a movement", cause })),
      SchemaError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "create a movement", cause })),
    }),
  );

  const addAlias = Effect.fn("CatalogStore.addAlias")(
    function* (id: MovementId, alias: string) {
      const entry = yield* Effect.gen(function* () {
        const movement = yield* catalogEntry(id);
        if (!movement) return yield* new CatalogNotFoundError({ id });
        yield* insertAlias(movement, alias);
        return yield* catalogEntry(id);
      }).pipe(sql.withTransaction);
      if (!entry) return yield* new CatalogNotFoundError({ id });
      return entry;
    },
    Effect.catchTags({
      SqlError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "add an alias", cause })),
      SchemaError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "add an alias", cause })),
    }),
  );

  const setVariationOf = Effect.fn("CatalogStore.setVariationOf")(
    function* (id: MovementId, variationOf: MovementId | null) {
      const entry = yield* Effect.gen(function* () {
        const { movements } = yield* loadAll;
        if (!movements.some((movement) => movement.id === id))
          return yield* new CatalogNotFoundError({ id });
        if (variationOf !== null) yield* checkVariation(movements, id, variationOf);
        yield* sql`UPDATE movements SET variation_of = ${variationOf} WHERE id = ${id}`;
        return yield* catalogEntry(id);
      }).pipe(sql.withTransaction);
      if (!entry) return yield* new CatalogNotFoundError({ id });
      return entry;
    },
    Effect.catchTags({
      SqlError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a core movement", cause })),
      SchemaError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a core movement", cause })),
    }),
  );

  const setLevels = Effect.fn("CatalogStore.setLevels")(
    function* (id: MovementId, input: SetMovementLevelsInput) {
      const entry = yield* Effect.gen(function* () {
        const result = yield* sql`
          UPDATE movements
          SET level_family = ${input.levelFamily}, accessory = ${input.accessory ? 1 : 0},
              complements = ${JSON.stringify([...new Set(input.complements)])},
              supports = ${JSON.stringify([...new Set(input.supports)])}
          WHERE id = ${id}
          RETURNING id
        `;
        if (result.length === 0) return undefined;
        return yield* catalogEntry(id);
      }).pipe(sql.withTransaction);
      if (!entry) return yield* new CatalogNotFoundError({ id });
      return entry;
    },
    Effect.catchTags({
      SqlError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a movement's levels", cause })),
      SchemaError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a movement's levels", cause })),
    }),
  );

  const setScalings = Effect.fn("CatalogStore.setScalings")(
    function* (id: MovementId, scalings: ReadonlyArray<MovementId>) {
      const entry = yield* Effect.gen(function* () {
        const { movements } = yield* loadAll;
        if (!movements.some((movement) => movement.id === id))
          return yield* new CatalogNotFoundError({ id });
        const known = new Set<string>(movements.map((movement) => movement.id));
        const missing = scalings.find((other) => !known.has(other));
        if (missing !== undefined) return yield* new CatalogNotFoundError({ id: missing });
        const kept = [...new Set(scalings)].filter((other) => other !== id);
        yield* sql`UPDATE movements SET scalings = ${JSON.stringify(kept)} WHERE id = ${id}`;
        return yield* catalogEntry(id);
      }).pipe(sql.withTransaction);
      if (!entry) return yield* new CatalogNotFoundError({ id });
      return entry;
    },
    Effect.catchTags({
      SqlError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a movement's scalings", cause })),
      SchemaError: (cause) =>
        Effect.fail(new CatalogPersistenceError({ operation: "set a movement's scalings", cause })),
    }),
  );

  return CatalogStore.of({ list, create, addAlias, setVariationOf, setLevels, setScalings });
});

export const layer = Layer.effect(CatalogStore, make);
