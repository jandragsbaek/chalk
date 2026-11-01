import { THE_BOX, type Place } from "@chalk/contracts";

/** A place as its `place` and `place_name` columns; absent is the box. */
export const placeColumns = (
  place: Place | undefined,
): { readonly place: Place["_tag"]; readonly placeName: string | null } => ({
  place: place?._tag ?? "box",
  placeName: place?._tag === "away" ? place.name : null,
});

/** The columns back; anything unreadable is the box, where every older session was. */
export const placeOf = (row: {
  readonly place: string;
  readonly placeName: string | null;
}): Place => {
  if (row.place === "home") return { _tag: "home" };
  if (row.place === "away" && row.placeName !== null && row.placeName.trim() !== "")
    return { _tag: "away", name: row.placeName.trim() };
  return THE_BOX;
};
