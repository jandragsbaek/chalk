import {
  CoachThreadId,
  type CoachStatus,
  type CoachThread,
  type CoachThreadDetail,
  type CoachTurn,
} from "@chalk/contracts";
import { useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { Composer } from "../components/coach/Composer.tsx";
import { receiptAnchor } from "../components/coach/Receipts.tsx";
import { ThreadRail } from "../components/coach/ThreadRail.tsx";
import { AthleteSection, CoachSection, ReadingSection } from "../components/coach/TurnSection.tsx";
import { FieldBox } from "../components/FieldBox.tsx";
import { starterPrompts, threadTurns, type LiveReply } from "../lib/coach.ts";
import { localIsoDate } from "../lib/utils.ts";
import {
  coachSendAtom,
  coachStatusAtom,
  coachThreadAtom,
  coachThreadsAtom,
} from "../state/coach.ts";
import { liftSetsAtom, movementsAtom } from "../state/strength.ts";
import { workoutsAtom } from "../state/workouts.ts";

/** The open conversation lives in the URL, so it survives reload and can be linked. */
const CoachSearch = Schema.Struct({ thread: Schema.optional(Schema.String) });

export const Route = createFileRoute("/coach")({
  validateSearch: Schema.toStandardSchemaV1(CoachSearch),
  component: CoachPage,
});

const decodeThreadId = Schema.decodeUnknownOption(CoachThreadId);

function CoachPage() {
  const { thread } = Route.useSearch();
  const threadId = Option.getOrUndefined(decodeThreadId(thread));
  const status = useAtomValue(coachStatusAtom);
  const threads = AsyncResult.getOrElse(useAtomValue(coachThreadsAtom), () => []);
  return (
    <main className="grid h-[calc(100dvh-3rem)] grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r bg-card">
        <ThreadRail threads={threads} current={threadId} />
      </aside>
      <Pane status={status} threadId={threadId} />
    </main>
  );
}

function Pane({
  status,
  threadId,
}: {
  readonly status: AsyncResult.AsyncResult<CoachStatus, unknown>;
  readonly threadId: CoachThreadId | undefined;
}) {
  if (AsyncResult.isFailure(status))
    return <Notice>Could not reach the server. Is it running?</Notice>;
  if (!AsyncResult.isSuccess(status)) return <div aria-busy aria-label="Loading the coach" />;
  return threadId === undefined ? (
    <ThreadPane key="new" threadId={undefined} saved={null} status={status.value} />
  ) : (
    <SavedThreadPane key={threadId} threadId={threadId} status={status.value} />
  );
}

function Notice({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="px-8 py-8">
      <p className="mx-auto max-w-[46rem] border border-destructive bg-card px-4 py-3 text-sm text-destructive">
        {children}
      </p>
    </div>
  );
}

/** What went wrong with a send, in the athlete's terms. */
function sendError(result: AsyncResult.AsyncResult<LiveReply, unknown>): string | null {
  if (!AsyncResult.isFailure(result)) return null;
  const error = Option.getOrUndefined(Cause.findErrorOption(result.cause));
  if (typeof error === "object" && error !== null && "_tag" in error) {
    switch (error._tag) {
      case "CoachUnavailableError":
        return "The coach is not set up on this server.";
      case "CoachThreadNotFoundError":
        return "This conversation no longer exists. Start a new one.";
      case "CoachStorageError":
        return "Could not save the conversation. Your message may not have been kept; try again.";
    }
  }
  return "Lost the connection to the server before the coach finished. Reload to see what was saved.";
}

/** A saved conversation: loads it, then hands it to the pane. */
function SavedThreadPane({
  threadId,
  status,
}: {
  readonly threadId: CoachThreadId;
  readonly status: CoachStatus;
}) {
  const detail = useAtomValue(coachThreadAtom(threadId));
  if (AsyncResult.isFailure(detail)) {
    const error = Option.getOrUndefined(Cause.findErrorOption(detail.cause));
    return (
      <Notice>
        {error?._tag === "CoachThreadNotFoundError"
          ? "This conversation was not found."
          : "Could not load this conversation."}{" "}
        <Link to="/coach" search={{}} className="underline">
          Start a new one
        </Link>
      </Notice>
    );
  }
  return (
    <ThreadPane
      threadId={threadId}
      saved={AsyncResult.getOrElse(detail, () => null)}
      status={status}
    />
  );
}

function ThreadPane({
  threadId,
  saved,
  status,
}: {
  readonly threadId: CoachThreadId | undefined;
  /** The saved thread; null while it loads, and for a new one. */
  readonly saved: CoachThreadDetail | null;
  readonly status: CoachStatus;
}) {
  const navigate = useNavigate({ from: "/coach" });
  const [sendResult, send] = useAtom(coachSendAtom);
  /** The last message sent from this pane, and when, so it can print before the server saves it. */
  const [sentHere, setSentHere] = useState<{ readonly text: string; readonly at: string } | null>(
    null,
  );
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const live = Option.getOrNull(AsyncResult.value(sendResult));
  const busy = sendResult.waiting;
  // A reply in progress belongs to this pane when it is for this thread, or when this new
  // conversation sent it (its thread only gets an id once the server saves the first turn).
  const liveHere =
    live !== null &&
    (threadId === undefined || live.thread === null
      ? sentHere !== null
      : live.thread.id === threadId)
      ? live
      : null;

  // A new conversation gets its id with the first saved turn; move the URL onto it.
  const startedId = liveHere?.thread?.id;
  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- keeps the router's URL on the thread the server just created, which arrives mid-stream rather than from a handler
  useEffect(() => {
    if (threadId === undefined && startedId !== undefined)
      void navigate({ search: { thread: startedId }, replace: true });
  }, [threadId, startedId, navigate]);

  const toggle = (number: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(number)) next.add(number);
      return next;
    });
  const cite = (number: number) => {
    setOpen((current) => new Set(current).add(number));
    requestAnimationFrame(() => {
      const row = document.getElementById(receiptAnchor(number));
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.querySelector("button")?.focus({ preventScroll: true });
    });
  };
  const submit = (text: string) => {
    setSentHere({ text, at: new Date().toISOString() });
    send(threadId === undefined ? { text } : { threadId, text });
  };

  const { turns, reading } = threadTurns(saved?.turns ?? [], liveHere);
  // Until the server has saved it, the message just sent prints as typed.
  const echo = busy && liveHere?.athlete == null ? sentHere : null;
  const nextSeq = (turns.at(-1)?.seq ?? 0) + 1;

  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- keeps the scroll pane pinned to the newest turn as the DOM grows (reads landing, replies saved), unless the athlete scrolled up to read
  useEffect(() => {
    const pane = scrollRef.current;
    const content = contentRef.current;
    if (pane === null || content === null) return;
    let pinned = true;
    const onScroll = () => {
      pinned = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
    };
    const observer = new ResizeObserver(() => {
      if (pinned) pane.scrollTop = pane.scrollHeight;
    });
    pane.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(content);
    return () => {
      pane.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          ref={contentRef}
          className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col gap-7 px-6 pt-7 pb-6"
        >
          {threadId === undefined ? (
            <NewThreadHead />
          ) : saved === null ? (
            <div
              aria-busy
              aria-label="Loading the conversation"
              className="h-40 border border-dashed border-input"
            />
          ) : (
            <ThreadHead thread={liveHere?.thread ?? saved.thread} />
          )}
          {turns.map((turn: CoachTurn) =>
            turn.role === "athlete" ? (
              <AthleteSection key={turn.seq} turn={turn} />
            ) : (
              <CoachSection
                key={turn.seq}
                turn={turn}
                open={open}
                onToggle={toggle}
                onCite={cite}
              />
            ),
          )}
          {echo === null ? null : (
            <AthleteSection
              turn={{
                seq: nextSeq,
                role: "athlete",
                text: echo.text,
                receipts: [],
                createdAt: echo.at,
              }}
            />
          )}
          {echo !== null || reading !== null ? (
            <ReadingSection
              seq={echo === null ? nextSeq : nextSeq + 1}
              reads={reading ?? []}
              open={open}
              onToggle={toggle}
            />
          ) : null}
          {threadId === undefined && echo === null && turns.length === 0 ? (
            <StarterPrompts ask={status.available && !busy ? submit : null} />
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t bg-background">
        <div className="mx-auto w-full max-w-[46rem] px-6 pt-3 pb-4">
          {status.available ? (
            <Composer
              placeholder={threadId === undefined ? "Ask about your training…" : "Reply…"}
              model={status.model ?? "the coach"}
              busy={busy}
              error={sentHere === null ? null : sendError(sendResult)}
              onSend={submit}
            />
          ) : (
            <p className="border border-dashed border-input bg-card px-4 py-3 text-sm">
              The coach is not set up on this server. Set{" "}
              <code className="font-mono">OPENROUTER_API_KEY</code> (and{" "}
              <code className="font-mono">CHALK_COACH_MODEL</code> to pick the model), then restart
              Chalk. Saved conversations stay readable.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const started = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** A thread's header: its numbers as protocol boxes, then its title on the 2px rule. */
function ThreadHead({ thread }: { readonly thread: CoachThread }) {
  return (
    <header className="grid gap-5">
      <dl className="grid grid-cols-4 divide-x border bg-card">
        <FieldBox label="Started">{started.format(new Date(thread.createdAt))}</FieldBox>
        <FieldBox label="Turns">{thread.turns}</FieldBox>
        <FieldBox label="Reads">{thread.reads}</FieldBox>
        <FieldBox label="Model">
          <span className="block truncate" title={thread.model}>
            {thread.model.split("/").at(-1)}
          </span>
        </FieldBox>
      </dl>
      <h1 className="protocol-title border-b-2 border-foreground pb-2 text-3xl text-balance">
        {thread.title}
      </h1>
    </header>
  );
}

/** A new conversation: what the coach does with your log. */
function NewThreadHead() {
  return (
    <header className="grid gap-5">
      <h1 className="protocol-title border-b-2 border-foreground pb-2 text-4xl">Ask the coach</h1>
      <p className="max-w-[60ch] text-base leading-7">
        The coach reads your log before it answers: sessions, lift sets, rep maxes and benchmark
        attempts. Every read prints as a numbered receipt you can open, and the reply cites them.
      </p>
    </header>
  );
}

/** Three questions grounded in the log, seated right above the composer. */
function StarterPrompts({ ask }: { readonly ask: ((text: string) => void) | null }) {
  const data = AsyncResult.all({
    workouts: useAtomValue(workoutsAtom),
    liftSets: useAtomValue(liftSetsAtom),
    movements: useAtomValue(movementsAtom),
  });
  const [today] = useState(() => localIsoDate(new Date()));
  const prompts = AsyncResult.match(data, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => starterPrompts({ ...value, today }),
  });
  if (prompts.length === 0) return null;
  return (
    <section aria-labelledby="coach-starters" className="mt-auto">
      <h2
        id="coach-starters"
        className="form-label border-b-2 border-foreground pb-1 text-muted-foreground"
      >
        Start from your log
      </h2>
      <ul className="border border-t-0 bg-card">
        {prompts.map((prompt) => (
          <li key={prompt} className="border-t first:border-t-0">
            <button
              type="button"
              disabled={ask === null}
              onClick={() => ask?.(prompt)}
              className="w-full cursor-pointer px-3 py-2 text-left text-sm font-semibold hover:bg-muted disabled:cursor-default disabled:opacity-45"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
