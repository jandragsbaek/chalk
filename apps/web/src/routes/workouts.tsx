import { MovementId, type CatalogMovement, type SessionEntry } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { monthSectionId, SessionRail } from "../components/sessions/SessionRail.tsx";
import { SessionRegister } from "../components/sessions/SessionRegister.tsx";
import { SessionSheet } from "../components/sessions/SessionSheet.tsx";
import {
  entryKey,
  filterSessions,
  groupByMonth,
  movementOptions,
  sessionYears,
  type SessionFilter,
} from "../lib/sessions.ts";
import { indexSimilar, type SimilarIndex } from "../lib/similar.ts";
import { catalogAtom } from "../state/imports.ts";
import { sessionsAtom, similarAtom } from "../state/sessions.ts";

/** Filters and the open session live in the URL, so a view can be linked and survives reload. */
const WorkoutsSearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  movement: Schema.optional(MovementId),
  year: Schema.optional(Schema.String),
  /** A workout id, or `day-2026-10-29` for a strength day. */
  session: Schema.optional(Schema.String),
});

export const Route = createFileRoute("/workouts")({
  validateSearch: Schema.toStandardSchemaV1(WorkoutsSearch),
  component: WorkoutsPage,
});

const DESK = "grid h-[calc(100dvh-3rem)] grid-cols-[8.5rem_27.5rem_minmax(0,1fr)]";

function WorkoutsPage() {
  const result = AsyncResult.all({
    entries: useAtomValue(sessionsAtom),
    catalog: useAtomValue(catalogAtom),
  });
  return AsyncResult.match(result, {
    onInitial: () => (
      <main className={DESK} aria-busy="true">
        <div className="border-r bg-background" />
        <p className="border-r bg-card px-4 py-8 text-sm text-muted-foreground">
          Loading sessions...
        </p>
        <div className="bg-card" />
      </main>
    ),
    onFailure: () => (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <p className="border border-destructive bg-card px-4 py-3 text-sm text-destructive">
          Could not load your sessions. Is the server running?
        </p>
      </main>
    ),
    onSuccess: ({ value: { entries, catalog } }) => (
      <SessionDesk entries={entries} catalog={catalog} />
    ),
  });
}

/** Typing in a field or picking in a select keeps its arrow keys. */
const ownsArrowKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

function SessionDesk({
  entries,
  catalog,
}: {
  readonly entries: ReadonlyArray<SessionEntry>;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/workouts" });
  // Comparing sessions is extra: the desk works without it while it loads or if it fails.
  const similarParts = AsyncResult.getOrElse(useAtomValue(similarAtom), () => undefined);
  const similar: SimilarIndex | undefined =
    similarParts === undefined ? undefined : indexSimilar(similarParts);
  const filter: SessionFilter = {
    query: search.q ?? "",
    movement: search.movement,
    year: search.year,
  };

  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const nameOf = (id: MovementId) => names.get(id) ?? id;
  const filtered = filterSessions(entries, filter, catalog);
  const groups = groupByMonth(filtered, entries);
  // The open session stays open when a filter hides it; with none open, the newest shown reads.
  const selected = entries.find((entry) => entryKey(entry) === search.session) ?? filtered[0];
  const selectedKey = selected === undefined ? undefined : entryKey(selected);
  const selectedEchoes =
    selected?._tag === "workout" ? (similar?.ofWorkout(selected.workout.id) ?? []) : [];

  const registerRef = useRef<HTMLDivElement>(null);
  const [readMonth, setReadMonth] = useState<string | undefined>(undefined);
  /** A month tab just pressed: it stays inked while the register scrolls, even when the
   * register ends before that month's head reaches the top. Any scrolling by hand releases it. */
  const jumpingTo = useRef<string | undefined>(undefined);
  // The month inked in the rail: the one scrolled to, or the newest one shown.
  const activeMonth = groups.some((group) => group.month === readMonth)
    ? readMonth
    : groups[0]?.month;

  /** Opens a session; the arrow keys also bring its row into view. */
  function select(key: string | undefined, reveal = false) {
    void navigate({ search: (previous) => ({ ...previous, session: key }), replace: true });
    if (reveal && key !== undefined) revealRow(key);
  }

  function revealRow(key: string, block: ScrollLogicalPosition = "nearest") {
    registerRef.current
      ?.querySelector(`[data-session-row="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ block });
  }

  function setFilter(next: Partial<SessionFilter>) {
    const merged = { ...filter, ...next };
    void navigate({
      search: (previous) => ({
        ...previous,
        q: merged.query === "" ? undefined : merged.query,
        movement: merged.movement,
        year: merged.year,
      }),
      replace: true,
    });
    // A new filter is a new register: read it from the top.
    registerRef.current?.scrollTo({ top: 0 });
    jumpingTo.current = undefined;
    setReadMonth(undefined);
  }

  /** The month whose head has reached the top of the register is the one being read. */
  function readActiveMonth() {
    const scroller = registerRef.current;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let month: string | undefined;
    for (const section of scroller.querySelectorAll<HTMLElement>("[data-month]")) {
      if (section.getBoundingClientRect().top - top > 1) break;
      month = section.dataset.month;
    }
    if (jumpingTo.current !== undefined) {
      if (month !== jumpingTo.current) return;
      jumpingTo.current = undefined;
    }
    if (month === readMonth) return;
    setReadMonth(month);
    if (month !== undefined)
      document.querySelector(`[data-rail-month="${month}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function jumpTo(month: string) {
    const scroller = registerRef.current;
    const section = document.getElementById(monthSectionId(month));
    if (!scroller || !section) return;
    jumpingTo.current = month;
    setReadMonth(month);
    scroller.scrollTo({
      top: section.offsetTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- scrolls the register to the session a link or reload opened, once the rows are in the DOM
  useEffect(() => {
    if (search.session !== undefined) revealRow(search.session, "center");
  }, []);

  // Up and down walk the register; the sheet follows.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (ownsArrowKeys(event.target) || document.querySelector("[role=alertdialog]")) return;
    if (filtered.length === 0) return;
    event.preventDefault();
    const index = filtered.findIndex((entry) => entryKey(entry) === selectedKey);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = index === -1 ? 0 : Math.min(filtered.length - 1, Math.max(0, index + step));
    select(entryKey(filtered[next]!), true);
  });

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- window keydown listener for walking the register while the page is mounted
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function handleDeleted() {
    const index = filtered.findIndex((entry) => entryKey(entry) === selectedKey);
    const neighbour = filtered[index + 1] ?? filtered[index - 1];
    select(neighbour === undefined ? undefined : entryKey(neighbour));
  }

  return (
    <main className={DESK}>
      <SessionRail groups={groups} activeMonth={activeMonth} onJump={jumpTo} />
      <SessionRegister
        groups={groups}
        total={entries.length}
        shown={filtered.length}
        filter={filter}
        movementOptions={movementOptions(entries, catalog)}
        years={sessionYears(entries)}
        selectedKey={selectedKey}
        nameOf={nameOf}
        repeatsEarlier={(workoutId) => similar?.repeatsEarlier(workoutId)}
        scrollRef={registerRef}
        onScroll={readActiveMonth}
        onScrollByHand={() => {
          jumpingTo.current = undefined;
        }}
        onFilter={setFilter}
      />
      {selected === undefined ? (
        <div className="flex items-center justify-center bg-card px-8 text-sm text-muted-foreground">
          <p className="max-w-sm text-center">
            {entries.length === 0
              ? "Each session you log or import opens here as its protocol sheet."
              : "No session open. Pick one in the register, or clear the filters."}
          </p>
        </div>
      ) : (
        <SessionSheet
          key={selectedKey}
          entry={selected}
          names={{ nameOf, catalog }}
          similar={selectedEchoes}
          onOpen={(workoutId) => select(workoutId, true)}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  );
}
