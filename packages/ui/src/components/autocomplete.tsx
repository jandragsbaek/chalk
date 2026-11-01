import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";

import { cn } from "../lib/utils.ts";
import { Input } from "./field.tsx";

/**
 * A free-text field with suggestions: the typed text is the value, and a picked row fills it.
 * Forms that must pick from a fixed list keep `NativeSelect` or `Select`.
 */
const Autocomplete = AutocompletePrimitive.Root;
const AutocompleteCollection = AutocompletePrimitive.Collection;

function AutocompleteInput(props: AutocompletePrimitive.Input.Props) {
  return (
    <AutocompletePrimitive.Input data-slot="autocomplete-input" render={<Input />} {...props} />
  );
}

/**
 * The popup, as wide as the field: a fresh sheet on a 1px ink stroke, flat like `Select`'s.
 * It hides while nothing matches, so a name of your own types without a list in the way.
 */
function AutocompletePopup({ className, children, ...props }: AutocompletePrimitive.Popup.Props) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        className="z-50 outline-none data-empty:hidden"
        sideOffset={4}
        align="start"
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-popup"
          className={cn(
            "w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) border border-foreground bg-card text-foreground outline-none transition-[opacity,scale] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  );
}

function AutocompleteList({ className, ...props }: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn("overflow-y-auto overscroll-contain py-1 outline-none", className)}
      {...props}
    />
  );
}

function AutocompleteGroup(props: AutocompletePrimitive.Group.Props) {
  return <AutocompletePrimitive.Group data-slot="autocomplete-group" {...props} />;
}

/** A group's heading in the form label's condensed caps (as `SelectLabel`), ruled off from its rows. */
function AutocompleteGroupLabel({ className, ...props }: AutocompletePrimitive.GroupLabel.Props) {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-group-label"
      className={cn(
        "sticky top-0 border-b bg-card px-2.5 pt-2 pb-1 text-[0.6875rem] leading-4 font-semibold font-stretch-condensed tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function AutocompleteItem({ className, ...props }: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "flex cursor-pointer items-baseline gap-3 px-2.5 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
};
