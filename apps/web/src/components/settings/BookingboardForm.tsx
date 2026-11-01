import type { BookingboardStatus } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId, useState } from "react";

import {
  BOOKINGBOARD_REACTIVITY_KEY,
  bookingboardStatusAtom,
  connectBookingboardAtom,
  disconnectBookingboardAtom,
} from "../../state/bookingboard.ts";
import { FieldBox } from "../FieldBox.tsx";
import { SectionHead } from "../today/SectionHead.tsx";
import { ConnectionVerdict } from "./ConnectionStatus.tsx";

const DAY_MS = 86_400_000;
/** Under this many days left, the token's expiry is shown as a warning. */
const WARN_DAYS = 5;

type Status =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "saved" }
  | { readonly type: "error"; readonly message: string };

const expiryDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/**
 * The box's bookingboard login, so the plan and the importer can pull a day's program. The
 * token is the site's `jwt` cookie; the server keeps it and only reports until when it works.
 */
export function BookingboardForm() {
  const result = useAtomValue(bookingboardStatusAtom);
  return AsyncResult.match(result, {
    onInitial: () => null,
    onFailure: () => (
      <p className="text-sm text-destructive">Could not read the bookingboard connection.</p>
    ),
    onSuccess: ({ value }) => <ConnectionForm status={value} />,
  });
}

function ConnectionForm({ status }: { readonly status: BookingboardStatus }) {
  const id = useId();
  const connect = useAtomSet(connectBookingboardAtom, { mode: "promiseExit" });
  const disconnect = useAtomSet(disconnectBookingboardAtom, { mode: "promiseExit" });
  const [token, setToken] = useState("");
  const [participant, setParticipant] = useState(() =>
    status._tag === "connected" ? String(status.participantId) : "",
  );
  const [save, setSave] = useState<Status>({ type: "idle" });
  const [now] = useState(() => Date.now());
  // An expired token opens the form straight away; a working one keeps it folded.
  const [replacing, setReplacing] = useState(
    () =>
      status._tag === "connected" && Math.floor((Date.parse(status.expiresAt) - now) / DAY_MS) < 0,
  );

  const participantId = Number(participant.trim());
  const participantValid = /^\d+$/.test(participant.trim()) && participantId > 0;
  const ready = token.trim() !== "" && participantValid && save.type !== "saving";
  const daysLeft =
    status._tag === "connected"
      ? Math.floor((Date.parse(status.expiresAt) - now) / DAY_MS)
      : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setSave({ type: "saving" });
    const exit = await connect({
      payload: { token: token.trim(), participantId },
      reactivityKeys: [BOOKINGBOARD_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) {
      setToken("");
      setReplacing(false);
      setSave({ type: "saved" });
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    setSave({
      type: "error",
      message: Option.isSome(failure) ? failure.value.message : "Could not save. Try again.",
    });
  }

  async function handleDisconnect() {
    setSave({ type: "saving" });
    const exit = await disconnect({
      payload: undefined,
      reactivityKeys: [BOOKINGBOARD_REACTIVITY_KEY],
    });
    setSave(
      Exit.isFailure(exit)
        ? { type: "error", message: "Could not disconnect. Try again." }
        : { type: "idle" },
    );
  }

  const expired = daysLeft !== undefined && daysLeft < 0;
  const showForm = status._tag === "disconnected" || replacing;

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead id={`${id}-title`} title="Bookingboard" meta="box7100.bookingboard.io" />
      <dl className="flex divide-x border-b bg-card whitespace-nowrap">
        {status._tag === "connected" && daysLeft !== undefined ? (
          <>
            <ConnectionVerdict
              state={expired ? "fail" : "good"}
              verdict={expired ? "Token expired" : "Connected"}
            >
              {expired ? "Paste a new token below." : "Plan and import read the box's program."}
            </ConnectionVerdict>
            <FieldBox label="Participant">{status.participantId}</FieldBox>
            <FieldBox label="Token until" wide>
              <span className={daysLeft < WARN_DAYS ? "text-destructive" : undefined}>
                {expiryDate.format(new Date(status.expiresAt))}
              </span>{" "}
              <span className="text-xs font-medium text-muted-foreground">
                {expired ? "expired" : daysLeft === 1 ? "1 day" : `${daysLeft} days`}
              </span>
            </FieldBox>
          </>
        ) : (
          <ConnectionVerdict state="off" verdict="Not connected">
            The plan and import start from a blank page.
          </ConnectionVerdict>
        )}
      </dl>
      {status._tag === "connected" ? (
        <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            The token is the site's <code>jwt</code> cookie and lasts 30 days. Chalk only reads with
            it.
          </p>
          <div className="flex shrink-0 gap-1.5">
            {replacing ? null : (
              <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
                Replace token
              </Button>
            )}
            <Button
              variant="ghost-destructive"
              size="sm"
              disabled={save.type === "saving"}
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : null}
      {showForm ? (
        <form onSubmit={handleSubmit} className="grid divide-y border-b bg-card">
          <div className="grid content-start gap-1.5 px-4 pb-3 pt-2">
            <label htmlFor={`${id}-token`} className="form-label text-muted-foreground">
              {status._tag === "connected" ? "New token" : "Token"}
            </label>
            <Input
              id={`${id}-token`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="eyJhbGciOi..."
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                if (save.type !== "saving") setSave({ type: "idle" });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Log in at box7100.bookingboard.io, open the developer tools, find the site's cookies
              (Application, then Cookies) and copy the value of <code>jwt</code>. It lasts 30 days.
            </p>
          </div>
          <div className="grid content-start gap-1.5 px-4 pb-3 pt-2">
            <label htmlFor={`${id}-participant`} className="form-label text-muted-foreground">
              Participant id
            </label>
            <Input
              id={`${id}-participant`}
              inputMode="numeric"
              autoComplete="off"
              className="max-w-40"
              value={participant}
              aria-invalid={participant.trim() !== "" && !participantValid}
              onChange={(event) => setParticipant(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your number in the box's bookingboard; Chalk picks your bookings out by it.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p
              role="status"
              className={
                save.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
              }
            >
              {save.type === "error" ? save.message : null}
            </p>
            <div className="flex shrink-0 gap-1.5">
              {replacing ? (
                <Button variant="ghost" onClick={() => setReplacing(false)}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={!ready}>
                {save.type === "saving"
                  ? "Checking..."
                  : status._tag === "connected"
                    ? "Replace token"
                    : "Connect"}
              </Button>
            </div>
          </div>
        </form>
      ) : save.type === "saved" || save.type === "error" ? (
        <p
          role="status"
          className={
            save.type === "error"
              ? "border-b bg-card px-4 py-2.5 text-sm text-destructive"
              : "border-b bg-card px-4 py-2.5 text-sm text-muted-foreground"
          }
        >
          {save.type === "error"
            ? save.message
            : "Connected. The plan and import pages can pull the box's program now."}
        </p>
      ) : null}
    </section>
  );
}
