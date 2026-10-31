import type * as React from "react";

import { cn } from "../lib/utils.ts";

const controlClassName =
  "w-full rounded-md border border-input bg-card px-2.5 text-base text-foreground outline-none transition-[border-color] duration-150 placeholder:text-muted-foreground hover:border-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(controlClassName, "h-9", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClassName, "min-h-20 resize-y py-2", className)}
      {...props}
    />
  );
}

/** Native select keeps the phone's own picker, which beats a custom popup at the gym. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(controlClassName, "h-9", className)}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export { Input, Label, NativeSelect, Textarea };
