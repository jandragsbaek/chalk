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
import { SectionHead } from "../today/SectionHead.tsx";

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

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead
        id={`${id}-title`}
        title="Bookingboard"
        meta={status._tag === "connected" ? "Connected" : "Not connected"}
      />
      <form onSubmit={handleSubmit} className="grid divide-y border-b bg-card">
        {status._tag === "connected" && daysLeft !== undefined ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm">
              Participant {status.participantId}.{" "}
              {daysLeft < 0 ? (
                <span className="text-destructive">The token has expired. Paste a new one.</span>
              ) : (
                <span className={daysLeft < WARN_DAYS ? "text-destructive" : undefined}>
                  Token works until {expiryDate.format(new Date(status.expiresAt))} (
                  {daysLeft === 1 ? "1 day" : `${daysLeft} days`}).
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="ghost-destructive"
              size="sm"
              disabled={save.type === "saving"}
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </Button>
          </div>
        ) : null}
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
            {save.type === "error"
              ? save.message
              : save.type === "saved"
                ? "Connected. The plan and import pages can pull the box's program now."
                : null}
          </p>
          <Button type="submit" disabled={!ready}>
            {save.type === "saving"
              ? "Checking..."
              : status._tag === "connected"
                ? "Replace token"
                : "Connect"}
          </Button>
        </div>
      </form>
    </section>
  );
}
