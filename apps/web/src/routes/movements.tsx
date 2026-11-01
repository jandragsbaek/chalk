import {
  MovementCategory,
  MovementId,
  type CatalogMovement,
  type LevelItem,
} from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { useEffect, useEffectEvent, useRef } from "react";

import { MovementRail } from "../components/movements/MovementRail.tsx";
import { MovementRegister } from "../components/movements/MovementRegister.tsx";
import { MovementSheet } from "../components/movements/MovementSheet.tsx";
import { filterMovements, movementUsage, type MovementFilter } from "../lib/movements.ts";
import { catalogAtom } from "../state/imports.ts";
import { levelsAtom } from "../state/strength.ts";

/** Filters and the open movement live in the URL, so a view can be linked and survives reload. */
const MovementsSearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  category: Schema.optional(MovementCategory),
  scalings: Schema.optional(Schema.Literals(["with", "without"])),
  movement: Schema.optional(MovementId),
});

export const Route = createFileRoute("/movements")({
  validateSearch: Schema.toStandardSchemaV1(MovementsSearch),
  component: MovementsPage,
});

const DESK = "grid h-[calc(100dvh-3rem)] grid-cols-[10rem_26rem_minmax(0,1fr)]";

function MovementsPage() {
  const catalog = useAtomValue(catalogAtom);
  // Usage is extra: the catalog reads and edits without it while it loads or if it fails.
  const items = AsyncResult.getOrElse(useAtomValue(levelsAtom), () => undefined)?.items ?? [];
  return AsyncResult.match(catalog, {
    onInitial: () => (
      <main className={DESK} aria-busy="true">
        <div className="border-r bg-background" />
        <p className="border-r bg-card px-4 py-8 text-sm text-muted-foreground">
          Loading the catalog...
        </p>
        <div className="bg-card" />
      </main>
    ),
    onFailure: () => (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <p className="border border-destructive bg-card px-4 py-3 text-sm text-destructive">
          Could not load the movement catalog. Is the server running?
        </p>
      </main>
    ),
    onSuccess: ({ value }) => <MovementDesk catalog={value} items={items} />,
  });
}

/** Typing in a field or picking in a select keeps its arrow keys. */
const ownsArrowKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

function MovementDesk({
  catalog,
  items,
}: {
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly items: ReadonlyArray<LevelItem>;
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/movements" });
  const registerRef = useRef<HTMLDivElement>(null);
  const filter: MovementFilter = {
    query: search.q ?? "",
    category: search.category,
    scalings: search.scalings,
  };
  const shown = filterMovements(catalog, filter);
  // The register reads category by category, so walking it follows that order.
  const ordered = MovementCategory.literals.flatMap((category) =>
    shown.filter((movement) => movement.category === category),
  );
  const selected = catalog.find((movement) => movement.id === search.movement) ?? ordered[0];
  const usageOf = movementUsage(items);

  function select(id: MovementId, reveal = false) {
    void navigate({ search: (previous) => ({ ...previous, movement: id }), replace: true });
    if (reveal) revealRow(id);
  }

  function revealRow(id: MovementId, block: ScrollLogicalPosition = "nearest") {
    registerRef.current
      ?.querySelector(`[data-movement-row="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block });
  }

  function setFilter(next: Partial<MovementFilter>) {
    const merged = { ...filter, ...next };
    void navigate({
      search: (previous) => ({
        ...previous,
        q: merged.query === "" ? undefined : merged.query,
        category: merged.category,
        scalings: merged.scalings,
      }),
      replace: true,
    });
    registerRef.current?.scrollTo({ top: 0 });
  }

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- scrolls the register to the movement a link or reload opened, once the rows are in the DOM
  useEffect(() => {
    if (search.movement !== undefined) revealRow(search.movement, "center");
  }, []);

  // Up and down walk the register; the sheet follows.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (ownsArrowKeys(event.target) || ordered.length === 0) return;
    event.preventDefault();
    const index = ordered.findIndex((movement) => movement.id === selected?.id);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = index === -1 ? 0 : Math.min(ordered.length - 1, Math.max(0, index + step));
    select(ordered[next]!.id, true);
  });

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- window keydown listener for walking the register while the page is mounted
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <main className={DESK}>
      <MovementRail catalog={catalog} filter={filter} onFilter={setFilter} />
      <MovementRegister
        movements={ordered}
        catalog={catalog}
        filter={filter}
        selectedId={selected?.id}
        scrollRef={registerRef}
        onFilter={setFilter}
      />
      {selected === undefined ? (
        <div className="flex items-center justify-center bg-card px-8 text-sm text-muted-foreground">
          <p className="max-w-sm text-center">
            No movement open. Clear the filters to see the catalog.
          </p>
        </div>
      ) : (
        <MovementSheet
          key={selected.id}
          movement={selected}
          catalog={catalog}
          usage={usageOf(selected.id)}
        />
      )}
    </main>
  );
}
