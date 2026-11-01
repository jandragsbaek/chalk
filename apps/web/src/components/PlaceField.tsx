import { BOX_LABEL, describePlace, HOME_LABEL, parsePlace, type Place } from "@chalk/contracts";
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@chalk/ui/components/autocomplete.tsx";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { knownPlaces } from "../lib/places.ts";
import { sessionsAtom } from "../state/sessions.ts";

const HINTS: Record<string, string> = {
  [BOX_LABEL]: "Your box",
  [HOME_LABEL]: "Trained at home",
};

/**
 * Where a session was trained: the box, home, or another box by name. Offers the box, home and
 * the other boxes of earlier sessions as you type; a new name is a new box. Cleared, it is the
 * box again.
 */
export function PlaceField({
  id,
  place,
  onChange,
}: {
  /** For a form's `<Label htmlFor>`; the header field labels itself. */
  readonly id?: string;
  readonly place: Place;
  readonly onChange: (place: Place) => void;
}) {
  const sessions = AsyncResult.getOrElse(useAtomValue(sessionsAtom), () => []);
  const described = describePlace(place);
  // As typed, so a space mid-name survives; the session gets it parsed.
  const [text, setText] = useState(described);
  if (describePlace(parsePlace(text)) !== described && text.trim() !== "") setText(described);
  const options = [BOX_LABEL, HOME_LABEL, ...knownPlaces(sessions)];

  function type(value: string) {
    setText(value);
    onChange(parsePlace(value));
  }

  return (
    <Autocomplete items={options} value={text} onValueChange={type} openOnInputClick>
      <AutocompleteInput
        {...(id === undefined ? { "aria-label": "Place" } : { id })}
        placeholder={BOX_LABEL}
        autoComplete="off"
        onBlur={() => setText(described)}
        className={id === undefined ? "w-40" : undefined}
      />
      <AutocompletePopup>
        <AutocompleteList className="max-h-[min(16rem,var(--available-height))]">
          {(option: string) => (
            <AutocompleteItem key={option} value={option}>
              <span className="font-semibold">{option}</span>
              <span className="text-xs text-muted-foreground">{HINTS[option] ?? "Away"}</span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
