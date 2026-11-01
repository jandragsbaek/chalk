import type { CoachModelOption } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@chalk/ui/components/select.tsx";
import { useState } from "react";

/** Characters the server accepts in one message. */
const MAX_LENGTH = 4000;

/**
 * Where the athlete types to the coach: a typed-source field (the athlete's words are always set
 * in the typewriter), Enter sends and Shift+Enter breaks the line. Under it, the model the
 * message goes to, which the athlete can change before any message.
 */
export function Composer({
  placeholder,
  models,
  model,
  onModelChange,
  busy,
  error,
  onSend,
}: {
  readonly placeholder: string;
  /** What the server offers, in menu order. */
  readonly models: ReadonlyArray<CoachModelOption>;
  /** The slug the next message goes to. */
  readonly model: string;
  readonly onModelChange: (slug: string) => void;
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
      {error === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>Enter sends, Shift+Enter breaks the line.</span>
        <ModelPicker models={models} model={model} onModelChange={onModelChange} />
      </div>
    </form>
  );
}

/** "Your log goes to [model] through OpenRouter.": the privacy line, with the model as a pick. */
function ModelPicker({
  models,
  model,
  onModelChange,
}: {
  readonly models: ReadonlyArray<CoachModelOption>;
  readonly model: string;
  readonly onModelChange: (slug: string) => void;
}) {
  const items = models.map((option) => ({ value: option.slug, label: option.label }));
  return (
    <span className="flex items-center gap-1.5">
      <span>Your log goes to</span>
      <Select
        items={items}
        value={model}
        onValueChange={(slug) => {
          if (slug !== null) onModelChange(slug);
        }}
      >
        <SelectTrigger aria-label="Coach model" size="sm" className="max-w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" align="end" className="w-80">
          <SelectLabel>
            <span>Model</span>
            <span>$ per M tokens in / out</span>
          </SelectLabel>
          {models.map((option) => (
            <SelectItem
              key={option.slug}
              value={option.slug}
              note={option.price ?? "Set on the server"}
              title={option.slug}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>through OpenRouter.</span>
    </span>
  );
}
