import type * as React from "react";

/** A connection's state as a referee lamp: white works, off is not set up, red is a no-lift. */
export type ConnectionState = "good" | "off" | "fail";

/**
 * The first box of a connection's strip: one lamp in its ink housing beside the verdict in
 * condensed caps and a one-line reason. Sits first inside the strip's `<dl>` and takes the width
 * the field boxes beside it leave.
 */
export function ConnectionVerdict({
  state,
  verdict,
  children,
}: {
  readonly state: ConnectionState;
  readonly verdict: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2">
      <dt className="sr-only">Status</dt>
      <span data-lamps aria-hidden className="flex shrink-0 p-1.5">
        <span data-lamp={state} />
      </span>
      <dd className="grid min-w-0 whitespace-normal">
        <span
          className={
            state === "fail"
              ? "text-sm font-bold uppercase leading-5 tracking-wide text-destructive font-stretch-condensed"
              : "text-sm font-bold uppercase leading-5 tracking-wide font-stretch-condensed"
          }
        >
          {verdict}
        </span>
        <span className="text-xs text-muted-foreground">{children}</span>
      </dd>
    </div>
  );
}
