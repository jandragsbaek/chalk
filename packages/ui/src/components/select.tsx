import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronsUpDown } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * A select with its own popup, for picks that need more than a native option can print (a
 * label and a note per row). Forms keep `NativeSelect`.
 */
const Select = SelectPrimitive.Root;

const selectTriggerVariants = cva(
  "inline-flex cursor-pointer items-center justify-between gap-2 border border-input bg-card text-foreground outline-none transition-[border-color] duration-150 select-none hover:border-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 data-disabled:cursor-default data-disabled:opacity-45 data-popup-open:border-foreground",
  {
    defaultVariants: { size: "default" },
    variants: {
      size: {
        default: "h-9 px-2.5 text-sm",
        /** Set inside a line of small print, like the coach composer's model pick. */
        sm: "h-7 px-2 text-xs font-semibold",
      },
    },
  },
);

function SelectTrigger({
  className,
  size,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
        <ChevronsUpDown aria-hidden className="size-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("truncate data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The popup: a fresh sheet on a 1px ink stroke, flat like the page (only dialogs lift). */
function SelectContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
        className="z-50 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "min-w-(--anchor-width) origin-(--transform-origin) border border-foreground bg-card text-foreground outline-none transition-[opacity,scale] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List className="max-h-(--available-height) overflow-y-auto py-1">
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** A row: a check where the current pick is, its text, then an optional note on the right. */
function SelectItem({
  className,
  children,
  note,
  ...props
}: SelectPrimitive.Item.Props & { readonly note?: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pr-3 pl-2 text-sm outline-none select-none data-disabled:cursor-default data-disabled:opacity-45 data-highlighted:bg-muted",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1">
        <Check aria-hidden className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 truncate">
        {children}
      </SelectPrimitive.ItemText>
      {note === undefined ? null : (
        <span className="col-start-3 text-xs text-muted-foreground tabular-nums">{note}</span>
      )}
    </SelectPrimitive.Item>
  );
}

/**
 * A heading over the rows in small condensed caps (the form label); its children spread across
 * the row, so a second one can head the notes column.
 */
function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn(
        "flex justify-between gap-4 border-b px-2 pt-1 pb-1.5 text-[0.6875rem] leading-4 font-semibold font-stretch-condensed tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

export { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue };
