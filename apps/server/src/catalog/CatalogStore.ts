import {
  AliasTakenError,
  CatalogMovement,
  CatalogNotFoundError,
  Movement,
  MovementExistsError,
  MovementId,
  normalizeMovementPhrase,
  type CreateMovementInput,
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
    operation: Schema.Literals(["list the catalog", "create a movement", "add an alias"]),
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
    /** A user-added movement; its id is the slug of its name. */
    readonly create: (
      input: CreateMovementInput,
    ) => Effect.Effect<
      CatalogMovement,
      MovementExistsError | AliasTakenError | CatalogPersistenceError
    >;
    /** Teaches the matcher another phrase for a movement; repeating one is a no-op. */
    readonly addAlias: (
      id: MovementId,
      alias: string,
    ) => Effect.Effect<
      CatalogMovement,
      CatalogNotFoundError | AliasTakenError | CatalogPersistenceError
    >;
  }
>()("chalk/catalog/CatalogStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectMovements = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Movement,
    execute: () => sql`SELECT id, name, category FROM movements ORDER BY category, name`,
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
    movements: ReadonlyArray<Movement>,
    aliases: ReadonlyArray<typeof AliasRow.Type>,
  ): ReadonlyArray<CatalogMovement> =>
    movements.map((movement) => ({
      ...movement,
      aliases: aliases.filter((row) => row.movementId === movement.id).map((row) => row.alias),
    }));

  /** Inserts `alias` for `movement` unless it already means it; fails when it means another. */
  const insertAlias = Effect.fn("CatalogStore.insertAlias")(function* (
    movement: Movement,
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
      const movement: Movement = {
        id: MovementId.make(slugify(input.name)),
        name: input.name,
        category: input.category,
      };
      const created = yield* Effect.gen(function* () {
        const { movements } = yield* loadAll;
        const taken = movements.find(
          (other) =>
            other.id === movement.id ||
            normalizeMovementPhrase(other.name) === normalizeMovementPhrase(movement.name),
        );
        if (taken) return yield* new MovementExistsError({ id: taken.id, name: taken.name });
        yield* sql`
        INSERT INTO movements (id, name, category, user_added)
        VALUES (${movement.id}, ${movement.name}, ${movement.category}, 1)
      `;
        for (const alias of input.aliases) yield* insertAlias(movement, alias);
        return yield* catalogEntry(movement.id);
      }).pipe(sql.withTransaction);
      return created ?? { ...movement, aliases: [] };
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

  return CatalogStore.of({ list, create, addAlias });
});

export const layer = Layer.effect(CatalogStore, make);
