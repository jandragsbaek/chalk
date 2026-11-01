import type { GarminStatus, IsoDate } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Textarea } from "@chalk/ui/components/field.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId, useState } from "react";
import type * as React from "react";

import { shiftDay } from "../../lib/bodyweight.ts";
import { formatDay, localIsoDate } from "../../lib/utils.ts";
import {
  connectGarminAtom,
  disconnectGarminAtom,
  GARMIN_REACTIVITY_KEY,
  garminStatusAtom,
  syncGarminAtom,
} from "../../state/garmin.ts";
import { PROFILE_REACTIVITY_KEY } from "../../state/profile.ts";
import { FieldBox } from "../FieldBox.tsx";
import { SectionHead } from "../today/SectionHead.tsx";
import { ConnectionVerdict } from "./ConnectionStatus.tsx";

const LOGIN_COMMAND = "pnpm garmin:login";
const REACTIVITY_KEYS = [GARMIN_REACTIVITY_KEY, PROFILE_REACTIVITY_KEY];

type Status =
  | { readonly type: "idle" }
  | { readonly type: "busy"; readonly action: "connect" | "sync" | "disconnect" }
  | { readonly type: "done"; readonly message: string }
  | { readonly type: "error"; readonly message: string };

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayClock = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Today 07:14", else "Oct 30, 07:14". */
function formatReadAt(iso: string, today: IsoDate): string {
  const at = new Date(iso);
  return localIsoDate(at) === today ? `Today ${clock.format(at)}` : dayClock.format(at);
}

const failureMessage = (
  exit: Exit.Exit<unknown, { readonly message: string }>,
  fallback: string,
) => {
  if (Exit.isSuccess(exit)) return fallback;
  const failure = Cause.findErrorOption(exit.cause);
  return Option.isSome(failure) ? failure.value.message : fallback;
};

/**
 * The Garmin Connect login that brings the scale's weigh-ins into bodyweight. The tokens come
 * from a login on the athlete's own machine; the server keeps and renews them, and only says
 * how its reads went.
 */
export function GarminForm() {
  return AsyncResult.match(useAtomValue(garminStatusAtom), {
    onInitial: () => null,
    onFailure: () => (
      <p className="text-sm text-destructive">Could not read the Garmin connection.</p>
    ),
    onSuccess: ({ value }) => <GarminConnection status={value} />,
  });
}

function GarminConnection({ status }: { readonly status: GarminStatus }) {
  const id = useId();
  const connect = useAtomSet(connectGarminAtom, { mode: "promiseExit" });
  const sync = useAtomSet(syncGarminAtom, { mode: "promiseExit" });
  const disconnect = useAtomSet(disconnectGarminAtom, { mode: "promiseExit" });
  const [today] = useState(() => localIsoDate(new Date()));
  const [tokens, setTokens] = useState("");
  const [importFrom, setImportFrom] = useState<string>(() =>
    status._tag === "connected"
      ? status.importFrom
      : (status.suggestedFrom ?? shiftDay(localIsoDate(new Date()), -365)),
  );
  const [renewing, setRenewing] = useState(false);
  const [work, setWork] = useState<Status>({ type: "idle" });
  const [copied, setCopied] = useState(false);

  const connected = status._tag === "connected";
  const failing = connected && status.lastError !== null;
  const showSetup = !connected || failing || renewing;
  const busy = work.type === "busy";
  const ready = tokens.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(importFrom) && !busy;

  async function handleConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setWork({ type: "busy", action: "connect" });
    const exit = await connect({
      payload: { tokens: tokens.trim(), importFrom },
      reactivityKeys: REACTIVITY_KEYS,
    });
    if (Exit.isFailure(exit)) {
      setWork({ type: "error", message: failureMessage(exit, "Could not connect. Try again.") });
      return;
    }
    setTokens("");
    setRenewing(false);
    const value = exit.value;
    setWork({
      type: "done",
      message:
        value._tag === "connected"
          ? `Connected. ${value.weighIns === 1 ? "1 weigh-in" : `${value.weighIns} weigh-ins`} from the scale since ${formatDay(value.importFrom)}.`
          : "Connected.",
    });
  }

  async function handleSync() {
    setWork({ type: "busy", action: "sync" });
    const exit = await sync({ payload: undefined, reactivityKeys: REACTIVITY_KEYS });
    if (Exit.isSuccess(exit)) {
      setWork({ type: "done", message: "Read the scale's latest weigh-ins." });
      return;
    }
    // A refused or unanswered read is kept on the connection, and the strip above says it.
    const failure = Cause.findErrorOption(exit.cause);
    const shown =
      Option.isSome(failure) &&
      (failure.value._tag === "GarminTokensRefusedError" ||
        failure.value._tag === "GarminUnavailableError");
    setWork(
      shown
        ? { type: "idle" }
        : { type: "error", message: failureMessage(exit, "Could not read Garmin. Try again.") },
    );
  }

  async function handleDisconnect() {
    setWork({ type: "busy", action: "disconnect" });
    const exit = await disconnect({ payload: undefined, reactivityKeys: REACTIVITY_KEYS });
    setRenewing(false);
    setWork(
      Exit.isFailure(exit)
        ? { type: "error", message: "Could not disconnect. Try again." }
        : { type: "done", message: "Disconnected. The weigh-ins already read stay in Chalk." },
    );
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(LOGIN_COMMAND);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const statusLine =
    work.type === "error" || work.type === "done" ? (
      <p
        role="status"
        className={
          work.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
        }
      >
        {work.message}
      </p>
    ) : (
      <p role="status" className="sr-only">
        {busy ? "Working..." : ""}
      </p>
    );

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead id={`${id}-title`} title="Garmin Connect" meta="Smart scale into bodyweight" />
      <dl className="flex divide-x border-b bg-card whitespace-nowrap">
        {status._tag === "connected" ? (
          <>
            <ConnectionVerdict
              state={failing ? "fail" : "good"}
              verdict={failing ? "Read failed" : "Synced"}
            >
              {status.lastError ?? "Reads new weigh-ins every 6 hours."}
            </ConnectionVerdict>
            <FieldBox label="Weigh-ins">{status.weighIns}</FieldBox>
            <FieldBox label="Since" wide>
              {formatDay(status.importFrom)}
            </FieldBox>
            <FieldBox label="Last read">
              {status.lastSyncAt === null ? (
                <span data-empty aria-label="Not read yet" />
              ) : (
                formatReadAt(status.lastSyncAt, today)
              )}
            </FieldBox>
          </>
        ) : (
          <>
            <ConnectionVerdict state="off" verdict="Not connected">
              Weigh-ins stay in Garmin.
            </ConnectionVerdict>
            <FieldBox label="Per day" wide>
              First reading{" "}
              <span className="text-xs font-medium text-muted-foreground">typed ones win</span>
            </FieldBox>
          </>
        )}
      </dl>

      {connected ? (
        <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            The scale's first reading of each day. A weigh-in you typed is never overwritten.
          </p>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleSync()}>
              {work.type === "busy" && work.action === "sync" ? "Reading..." : "Sync now"}
            </Button>
            {showSetup ? null : (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRenewing(true)}>
                New tokens
              </Button>
            )}
            <Button
              variant="ghost-destructive"
              size="sm"
              disabled={busy}
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : null}

      {showSetup ? (
        <form
          onSubmit={handleConnect}
          aria-label="Connect Garmin"
          className="grid divide-y border-b bg-card"
        >
          <SetupRow label="1 · Log in">
            <p className="text-sm">
              On your own machine, once. Garmin's login only lets a browser through, so a small
              script does it there and asks for your MFA code.
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3 border border-input bg-background py-1 pr-1 pl-2.5">
              <code className="font-mono text-sm">{LOGIN_COMMAND}</code>
              <Button variant="ghost" size="sm" onClick={() => void copyCommand()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              From the Chalk checkout; it runs python-garminconnect with uv. Your password stays in
              the terminal, and it prints the tokens.
            </p>
          </SetupRow>
          <SetupRow label="2 · Paste tokens" htmlFor={`${id}-tokens`}>
            <div className="font-mono">
              <Textarea
                id={`${id}-tokens`}
                autoComplete="off"
                spellCheck={false}
                rows={3}
                placeholder='{"di_token": "eyJhbGciOi...", "di_refresh_token": "...", "di_client_id": "..."}'
                value={tokens}
                onChange={(event) => {
                  setTokens(event.target.value);
                  if (!busy) setWork({ type: "idle" });
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Chalk keeps them on the server, renews them itself, and never sends them back to the
              browser.
            </p>
          </SetupRow>
          <SetupRow label="3 · Import" htmlFor={`${id}-from`}>
            <div className="flex items-end justify-between gap-4">
              <div className="grid gap-1">
                <Input
                  id={`${id}-from`}
                  type="date"
                  max={today}
                  className="w-44"
                  value={importFrom}
                  onChange={(event) => setImportFrom(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {status._tag === "disconnected" && status.suggestedFrom === importFrom
                    ? "Your first logged session. Earlier weigh-ins stay in Garmin."
                    : "Earlier weigh-ins stay in Garmin."}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {renewing ? (
                  <Button variant="ghost" onClick={() => setRenewing(false)}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={!ready}>
                  {work.type === "busy" && work.action === "connect"
                    ? "Importing..."
                    : "Connect and import"}
                </Button>
              </div>
            </div>
          </SetupRow>
          {work.type === "error" || work.type === "done" ? (
            <div className="px-4 py-2.5">{statusLine}</div>
          ) : (
            statusLine
          )}
        </form>
      ) : (
        <div className="border-b bg-card px-4 py-2.5 empty:hidden">
          {work.type === "idle" ? null : statusLine}
        </div>
      )}
    </section>
  );
}

/** One step of the setup: its printed label in a 9.5rem column, the step beside it. */
function SetupRow({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
      {htmlFor === undefined ? (
        <span className="form-label pt-0.5 text-muted-foreground">{label}</span>
      ) : (
        <label htmlFor={htmlFor} className="form-label pt-0.5 text-muted-foreground">
          {label}
        </label>
      )}
      <div className="grid content-start">{children}</div>
    </div>
  );
}
