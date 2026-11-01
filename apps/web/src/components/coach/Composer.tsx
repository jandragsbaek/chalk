import { Button } from "@chalk/ui/components/button.tsx";
import { useState } from "react";

/** Characters the server accepts in one message. */
const MAX_LENGTH = 4000;

/**
 * Where the athlete types to the coach: a typed-source field (the athlete's words are always set
 * in the typewriter), Enter sends and Shift+Enter breaks the line.
 */
export function Composer({
  placeholder,
  model,
  busy,
  error,
  onSend,
}: {
  readonly placeholder: string;
  readonly model: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const send = () => {
    if (busy || trimmed === "") return;
    onSend(trimmed);
    setText("");
  };
  return (
    <form
      aria-label="Message the coach"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="grid gap-1.5"
    >
      <div className="flex items-end gap-2 border border-input bg-card p-2 pl-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 hover:border-foreground">
        <label htmlFor="coach-message" className="sr-only">
          Message
        </label>
        <textarea
          id="coach-message"
          autoFocus
          value={text}
          maxLength={MAX_LENGTH}
          rows={Math.min(6, Math.max(2, text.split("\n").length))}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          className="min-w-0 flex-1 resize-none bg-transparent py-1 font-mono text-base leading-7 outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={busy || trimmed === ""}>
          {busy ? "Coach is working…" : "Send"}
        </Button>
      </div>
      {error === null ? (
        <p className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>Enter sends, Shift+Enter breaks the line.</span>
          <span>Your log goes to {model} through OpenRouter.</span>
        </p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
