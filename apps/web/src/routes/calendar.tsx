import {
  IsoDate,
  ProgrammedSessionId,
  type BlockId,
  type LiftSet,
  type Movement,
  type MovementId,
  type RestDay,
  type SessionPlan,
  type TrainingBlock,
  type TrainingMax,
  type Workout,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Exit from "effect/Exit";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Board, type DragHandlers } from "../components/calendar/Board.tsx";
import { CalendarRail, plannedDays } from "../components/calendar/CalendarRail.tsx";
import { DraftTray } from "../components/calendar/DraftTray.tsx";
import { LanesRuler } from "../components/calendar/LanesRuler.tsx";
import { SessionDetail } from "../components/calendar/SessionDetail.tsx";
import {
  calendarDays,
  liftedOn,
  nextMonday,
  rulerWeeks,
  sessionEntry,
  sessionState,
  shiftDays,
  weekNumber,
  weekOf,
  weekTally,
} from "../lib/calendar.ts";
import { trainingDays } from "../lib/dashboard.ts";
import { toDate } from "../lib/progress.ts";
import { localIsoDate } from "../lib/utils.ts";
import { plansAtom } from "../state/plans.ts";
import { restDaysAtom } from "../state/restDays.ts";
import { liftSetsAtom, movementsAtom } from "../state/strength.ts";
import {
  BLOCKS_REACTIVITY_KEY,
  blocksAtom,
  moveSessionAtom,
  removeBlockAtom,
  removeSessionAtom,
  scheduleBlockAtom,
  setTrainingMaxAtom,
  tickLineAtom,
} from "../state/training.ts";
import { workoutsAtom } from "../state/workouts.ts";

/** `?week=` is any day of the board's first week; `?session=` the session open in the rail. */
const CalendarSearch = Schema.Struct({
  week: Schema.optional(IsoDate),
  session: Schema.optional(ProgrammedSessionId),
});

export const Route = createFileRoute("/calendar")({
  validateSearch: Schema.toStandardSchemaV1(CalendarSearch),
  component: CalendarPage,
});

/** Weeks the lanes ruler shows before the board's first week, and after it. */
const RULER_BEFORE = 3;
const RULER_AFTER = 8;

function CalendarPage() {
  const result = AsyncResult.all({
    blocks: useAtomValue(blocksAtom),
    workouts: useAtomValue(workoutsAtom),
    liftSets: useAtomValue(liftSetsAtom),
    movements: useAtomValue(movementsAtom),
    plans: useAtomValue(plansAtom),
    restDays: useAtomValue(restDaysAtom),
  });
  return AsyncResult.match(result, {
    onInitial: () => <CalendarSkeleton />,
    onFailure: () => (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <p className="border border-destructive bg-card px-4 py-3 text-sm text-destructive">
          Could not load the calendar. Is the server running?
        </p>
      </main>
    ),
    onSuccess: ({ value }) => <CalendarDesk {...value} />,
  });
}

function CalendarDesk({
  blocks: stored,
  workouts,
  liftSets,
  movements,
  plans,
  restDays,
}: {
  readonly blocks: ReadonlyArray<TrainingBlock>;
  readonly workouts: ReadonlyArray<Workout>;
  readonly liftSets: ReadonlyArray<LiftSet>;
  readonly movements: ReadonlyArray<Movement>;
  readonly plans: ReadonlyArray<SessionPlan>;
  readonly restDays: ReadonlyArray<RestDay>;
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });
  const [todayIso] = useState(() => localIsoDate(new Date()));
  const [dragging, setDragging] = useState<ProgrammedSessionId | null>(null);
  // Moves show at once rather than after the refetch; a kept move matches the stored day once it lands.
  const [moved, setMoved] = useState<ReadonlyMap<ProgrammedSessionId, string>>(new Map());
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState<ProgrammedSessionId | null>(null);

  const moveSession = useAtomSet(moveSessionAtom, { mode: "promiseExit" });
  const tickLine = useAtomSet(tickLineAtom, { mode: "promiseExit" });
  const removeSession = useAtomSet(removeSessionAtom, { mode: "promiseExit" });
  const scheduleBlock = useAtomSet(scheduleBlockAtom, { mode: "promiseExit" });
  const removeBlock = useAtomSet(removeBlockAtom, { mode: "promiseExit" });
  const setTrainingMax = useAtomSet(setTrainingMaxAtom, { mode: "promiseExit" });
  const reactivityKeys = [BLOCKS_REACTIVITY_KEY];

  const blocks = stored.map((block) =>
    block.sessions.some((session) => moved.has(session.id))
      ? {
          ...block,
          sessions: block.sessions
            .map((session) => ({ ...session, day: moved.get(session.id) ?? session.day }))
            .sort((a, b) => a.day.localeCompare(b.day)),
        }
      : block,
  );
  const names = new Map<MovementId, string>(
    movements.map((movement) => [movement.id, movement.name]),
  );
  const lifted = liftedOn(liftSets);
  const sessionsOf = (block: TrainingBlock) =>
    block.sessions.map((session) => sessionEntry(session, block, lifted));

  const anchor = search.week ?? todayIso;
  const todayMonday = weekOf(todayIso)[0] ?? todayIso;
  const left = weekOf(anchor);
  const right = weekOf(nextMonday(anchor));
  const ruler = rulerWeeks(anchor, RULER_BEFORE, RULER_AFTER);
  const anchorDate = toDate(anchor);
  const monthStart = localIsoDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1));
  const monthsEnd = localIsoDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 2, 0));
  const rulerEnd = shiftDays(ruler.at(-1) ?? anchor, 6);
  const from = [monthStart, ruler[0] ?? anchor].sort()[0] ?? anchor;
  const to = [monthsEnd, rulerEnd].sort().at(-1) ?? anchor;
  const rest = new Map(restDays.map((mark) => [mark.day, mark]));
  const days = calendarDays({ from, to, blocks, workouts, plans, liftSets, rest });
  const byDay = new Map(days.map((day) => [day.iso, day]));
  const leftDays = left.flatMap((iso) => byDay.get(iso) ?? []);
  const rightDays = right.flatMap((iso) => byDay.get(iso) ?? []);
  const boardSpan = { from: left[0] ?? anchor, to: right[6] ?? anchor };

  const entries = blocks.flatMap(sessionsOf);
  const selected = entries.find((entry) => entry.session.id === search.session);
  const drafts = blocks.filter((block) => block.status === "draft");
  const doneByBlock = new Map<BlockId, number>(
    blocks.map((block) => [
      block.id,
      sessionsOf(block).filter((entry) => sessionState(entry, todayIso) === "done").length,
    ]),
  );
  const tally = weekTally(leftDays, todayIso);
  const ahead = rightDays.reduce(
    (sum, day) => sum + day.sessions.filter((entry) => entry.block.status === "scheduled").length,
    0,
  );
  const boxAhead = rightDays.reduce((sum, day) => sum + day.plans.length, 0);

  const goToWeek = (iso: string) =>
    void navigate({ search: (prev) => ({ ...prev, week: iso === todayIso ? undefined : iso }) });
  const select = (id: ProgrammedSessionId | undefined) =>
    void navigate({ search: (prev) => ({ ...prev, session: id }) });
  const openFromTray = (id: ProgrammedSessionId | undefined) => {
    const entry = entries.find((candidate) => candidate.session.id === id);
    void navigate({
      search: (prev) => ({
        ...prev,
        session: id,
        ...(entry === undefined ||
        (entry.session.day >= boardSpan.from && entry.session.day <= boardSpan.to)
          ? {}
          : { week: entry.session.day }),
      }),
    });
  };

  async function move(id: ProgrammedSessionId, day: string) {
    const entry = entries.find((candidate) => candidate.session.id === id);
    if (entry === undefined || entry.session.day === day) return;
    setMoved((prev) => new Map(prev).set(id, day));
    const exit = await moveSession({ payload: { id, day }, reactivityKeys });
    if (Exit.isFailure(exit)) {
      setMoved((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setNotice(`Could not move ${entry.session.title}. Try again.`);
      return;
    }
    setNotice(undefined);
    setLanded(id);
    setTimeout(() => setLanded((current) => (current === id ? null : current)), 900);
  }

  async function run(work: Promise<Exit.Exit<unknown, unknown>>, failure: string) {
    setBusy(true);
    const exit = await work;
    setBusy(false);
    setNotice(Exit.isFailure(exit) ? failure : undefined);
    return Exit.isSuccess(exit);
  }

  const setMax = (id: BlockId, max: TrainingMax) =>
    void run(
      setTrainingMax({ payload: { id, max }, reactivityKeys }),
      "Could not set the training max. Try again.",
    );

  const drag: DragHandlers = {
    dragging,
    onDragStart: setDragging,
    onDragEnd: () => setDragging(null),
    onDrop: (id, day) => {
      setDragging(null);
      void move(id, day);
    },
    landed,
  };

  // Alt and the arrows move the open session a day; Escape closes it.
  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- keeps a window keydown listener bound to the open session
  useEffect(() => {
    if (selected === undefined) return;
    const { id, day } = { id: selected.session.id, day: selected.session.day };
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape")
        void navigate({ search: (prev) => ({ ...prev, session: undefined }) });
      if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      void move(id, shiftDays(day, event.key === "ArrowLeft" ? -1 : 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const leftWeek = weekNumber(left[0] ?? anchor);
  const rightWeek = weekNumber(right[0] ?? anchor);

  return (
    <main className="grid h-[calc(100dvh-3rem)] grid-cols-[16rem_minmax(0,1fr)] overflow-hidden 2xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside
        data-cal-scroll
        aria-label={selected ? "Session" : "Months and blocks"}
        className="min-h-0 overflow-y-auto border-r bg-card"
      >
        {selected === undefined ? (
          <CalendarRail
            anchor={anchor}
            todayIso={todayIso}
            trained={trainingDays(workouts, liftSets)}
            rest={rest}
            planned={plannedDays(days)}
            window={boardSpan}
            blocks={blocks}
            doneByBlock={doneByBlock}
            names={names}
            onPick={goToWeek}
            onSetMax={setMax}
            onRemoveBlock={(id) =>
              void run(
                removeBlock({ payload: { id }, reactivityKeys }),
                "Could not remove the block. Try again.",
              )
            }
          />
        ) : (
          <SessionDetail
            entry={selected}
            todayIso={todayIso}
            names={names}
            onClose={() => select(undefined)}
            onMove={(id, day) => void move(id, day)}
            onTick={(id, line, done) =>
              void run(
                tickLine({ payload: { id, line, done }, reactivityKeys }),
                "Could not save the tick. Try again.",
              )
            }
            onSetMax={setMax}
            onRemove={(id) =>
              void run(
                removeSession({ payload: { id }, reactivityKeys }),
                "Could not remove the session. Try again.",
              ).then((ok) => ok && select(undefined))
            }
          />
        )}
      </aside>

      <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <header className="flex items-stretch border-b bg-card">
          <div className="grid content-center border-r px-5 py-2">
            <h1 className="protocol-title text-3xl">
              Week {leftWeek} → {rightWeek}
            </h1>
          </div>
          <div className="grid content-center gap-0.5 border-r px-4 py-2">
            <span className="form-label text-muted-foreground">Week {leftWeek} done</span>
            <span className="text-lg font-semibold leading-7 tabular-nums font-stretch-semi-condensed">
              {tally.programmed === 0 ? (
                <span data-empty aria-label="Nothing programmed" />
              ) : (
                `${tally.done} of ${tally.programmed}`
              )}
              {tally.boxSessions > 0 ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  + {tally.boxSessions} logged
                </span>
              ) : null}
            </span>
          </div>
          <div className="grid content-center gap-0.5 border-r px-4 py-2">
            <span className="form-label text-muted-foreground">Week {rightWeek} ahead</span>
            <span className="text-lg font-semibold leading-7 tabular-nums font-stretch-semi-condensed">
              {ahead} programmed
              {boxAhead > 0 ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  + {boxAhead} box
                </span>
              ) : null}
            </span>
          </div>
          <p
            role="status"
            className="flex min-w-0 flex-1 items-center px-4 text-sm text-destructive"
          >
            {notice}
          </p>
          <nav aria-label="Weeks" className="flex items-center gap-1.5 px-4">
            <Button
              variant="outline"
              size="sm"
              aria-label="One week earlier"
              onClick={() => goToWeek(shiftDays(anchor, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(left[0] ?? "") === todayMonday}
              onClick={() => goToWeek(todayIso)}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="One week later"
              onClick={() => goToWeek(shiftDays(anchor, 7))}
            >
              <ChevronRight />
            </Button>
          </nav>
        </header>

        <LanesRuler
          weeks={ruler}
          windowStart={RULER_BEFORE}
          todayIso={todayIso}
          blocks={blocks}
          sessionsOf={sessionsOf}
          onPick={goToWeek}
        />

        <Board
          weeks={[leftDays, rightDays]}
          todayIso={todayIso}
          todayMonday={todayMonday}
          selected={search.session}
          onSelect={select}
          drag={drag}
        />

        <DraftTray
          drafts={drafts}
          sessionsOf={sessionsOf}
          todayIso={todayIso}
          names={names}
          selected={search.session}
          onOpen={openFromTray}
          drag={drag}
          busy={busy}
          onSchedule={(id) =>
            void run(
              scheduleBlock({ payload: { id }, reactivityKeys }),
              "Could not put the block in the calendar. Try again.",
            )
          }
          onDiscard={(id) =>
            void run(
              removeBlock({ payload: { id }, reactivityKeys }),
              "Could not discard the draft. Try again.",
            )
          }
        />
      </div>
    </main>
  );
}

/** The desk's shape in dashed boxes while the data loads. */
function CalendarSkeleton() {
  return (
    <main
      aria-busy
      aria-label="Loading the calendar"
      className="grid h-[calc(100dvh-3rem)] grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <aside className="border-r bg-card p-5">
        <div className="h-96 border border-dashed border-input" />
      </aside>
      <div className="grid grid-rows-[4rem_5rem_minmax(0,1fr)] gap-4 p-4">
        <div className="border border-dashed border-input" />
        <div className="border border-dashed border-input" />
        <div className="border border-dashed border-input" />
      </div>
    </main>
  );
}
