import type { CoachThread, CoachThreadId } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The conversations, most recently answered first. The one being read is double-outlined; one
 * whose last message has no answer is dashed, like any open row.
 */
export function ThreadRail({
  threads,
  current,
}: {
  readonly threads: ReadonlyArray<CoachThread>;
  readonly current: CoachThreadId | undefined;
}) {
  return (
    <nav aria-label="Coach conversations" className="flex min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-background pr-2 pl-4">
        <h2 className="form-label text-muted-foreground">Conversations</h2>
        <Button variant="outline" size="sm" render={<Link to="/coach" search={{}} />}>
          <Plus aria-hidden />
          New
        </Button>
      </div>
      {threads.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Nothing yet. Your conversations with the coach are kept here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {threads.map((thread) => (
            <li key={thread.id} className="border-b">
              <Link
                to="/coach"
                search={{ thread: thread.id }}
                data-coach-thread
                data-current={thread.id === current || undefined}
                data-unanswered={thread.unanswered || undefined}
                aria-current={thread.id === current ? "page" : undefined}
                className="grid gap-0.5 px-4 py-2 hover:bg-muted"
              >
                <span className="line-clamp-2 text-sm font-semibold">{thread.title}</span>
                <span className="text-xs text-muted-foreground">
                  {day.format(new Date(thread.updatedAt))} ·{" "}
                  {thread.unanswered ? "No answer yet" : plural(thread.reads, "read")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
