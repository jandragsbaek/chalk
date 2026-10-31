import type * as React from "react";

/**
 * One box of a protocol header: a small printed label in the corner, the entry below it. Use
 * inside a `<dl>`; boxes share their rules.
 */
export function FieldBox({
  label,
  children,
  wide,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div
      className={
        wide ? "grid min-w-40 content-start px-3 py-1.5" : "grid content-start px-3 py-1.5"
      }
    >
      <dt className="form-label text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold leading-7 tabular-nums font-stretch-semi-condensed">
        {children}
      </dd>
    </div>
  );
}
