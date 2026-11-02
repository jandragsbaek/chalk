import { Button } from "@chalk/ui/components/button.tsx";
import { Label, Textarea } from "@chalk/ui/components/field.tsx";
import { Plus } from "lucide-react";
import { useId, useState } from "react";

/**
 * Work done beside the board (a PR attempt after class, goofing around), typed as it would be
 * written: each line joins the session's text under "Extra work", so it is read and saved like
 * the rest. Enter adds; Shift+Enter starts another line.
 */
export function ExtraWorkField({ onAdd }: { readonly onAdd: (typed: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const id = useId();

  function add() {
    if (typed.trim() === "") return;
    onAdd(typed);
    setTyped("");
    setOpen(false);
  }

  if (!open)
    return (
      <div className="border-t bg-background px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus />
          Extra work
        </Button>
      </div>
    );

  return (
    <form
      className="grid gap-1.5 border-t bg-background px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <Label htmlFor={id}>Extra work</Label>
      <div className="font-mono">
        <Textarea
          id={id}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              add();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          placeholder="Clean and jerk 1x1 @ 100 kg"
          className="min-h-16"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={typed.trim() === ""}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          As you would write it. A lift with reps and a load counts as lifted.
        </span>
      </div>
    </form>
  );
}
