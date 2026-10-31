import { MovementId, makeMovementMatcher, suggestSpans, type Span } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { editorReducer, initialEditorState, type EditorState } from "./importEditor.ts";

const CATALOG = [
  { id: MovementId.make("double-under"), name: "Double-under", aliases: [] },
  { id: MovementId.make("burpee"), name: "Burpee", aliases: [] },
  { id: MovementId.make("thruster"), name: "Thruster", aliases: [] },
];

const TEXT = `- Amrap 15
- 60 Double under or 90 Single unders
- 12 Burpee over rower
- 10 Burpee over rower @ the end`;

const start = () => {
  let next = 0;
  return initialEditorState({
    text: TEXT,
    spans: suggestSpans(TEXT, makeMovementMatcher(CATALOG), () => `s${++next}`),
  });
};

const at = (state: EditorState, phrase: string, nth = 0) => {
  let from = -1;
  for (let index = 0; index <= nth; index++) from = state.text.indexOf(phrase, from + 1);
  return { start: from, end: from + phrase.length };
};

const spanAt = (state: EditorState, phrase: string, nth = 0): Span | undefined => {
  const range = at(state, phrase, nth);
  return state.spans.find((span) => span.start === range.start && span.end === range.end);
};

describe("editorReducer", () => {
  it("tags intent as whole lines, without the bullet or comment stars", () => {
    const text = "- Back squat\n- *Build to a heavy single,\n- about RPE 9.*\n- 1 rep";
    const state = initialEditorState({ text, spans: [] });
    const tagged = editorReducer(state, {
      type: "tag",
      start: text.indexOf("heavy"),
      end: text.indexOf("RPE"),
      choice: { tag: "intent" },
    });
    const [intent] = tagged.spans;
    expect(intent?._tag).toBe("intent");
    expect(text.slice(intent!.start, intent!.end)).toBe("Build to a heavy single,\n- about RPE 9.");
  });

  it("orders loaded spans by offset, as rendering needs", () => {
    const starts = start().spans.map((span) => span.start);
    expect(starts).toEqual([...starts].sort((left, right) => left - right));
  });

  it("tagging a movement after 'or' links it and claims the orphan count on its line", () => {
    const state = start();
    expect(spanAt(state, "90")).toMatchObject({ _tag: "quantity" });
    expect(spanAt(state, "90")).not.toHaveProperty("attachedTo");

    const tagged = editorReducer(state, {
      type: "tag",
      ...at(state, "Single unders"),
      choice: { tag: "movement", movementId: undefined },
    });
    const singles = spanAt(tagged, "Single unders");
    expect(singles).toMatchObject({
      _tag: "movement",
      alternativeOf: spanAt(tagged, "Double under")?.id,
    });
    expect(spanAt(tagged, "90")).toMatchObject({ attachedTo: singles?.id });
    expect(tagged.selectedId).toBe(singles?.id);
  });

  it("re-highlighting a longer phrase replaces the movement and keeps what hung off it", () => {
    const state = start();
    const tagged = editorReducer(state, {
      type: "tag",
      ...at(state, "Burpee over rower"),
      choice: { tag: "movement", movementId: undefined },
    });
    const longer = spanAt(tagged, "Burpee over rower");
    expect(spanAt(tagged, "Burpee")).toBeUndefined();
    expect(spanAt(tagged, "12")).toMatchObject({ attachedTo: longer?.id });
  });

  it("a learned phrase upgrades its other occurrences", () => {
    const state = start();
    const id = MovementId.make("burpee-over-rower");
    const learned = editorReducer(state, {
      type: "tagPhrase",
      phrase: "Burpee over rower",
      movementId: id,
    });
    expect(spanAt(learned, "Burpee over rower", 0)).toMatchObject({ movementId: id });
    expect(spanAt(learned, "Burpee over rower", 1)).toMatchObject({ movementId: id });
    expect(spanAt(learned, "10")).toMatchObject({
      attachedTo: spanAt(learned, "Burpee over rower", 1)?.id,
    });
  });

  it("attaches by picking, and removing a movement detaches its quantities", () => {
    const state = start();
    const ninety = spanAt(state, "90")!;
    const burpee = spanAt(state, "Burpee")!;
    const picked = editorReducer(
      editorReducer(editorReducer(state, { type: "select", id: ninety.id }), {
        type: "pick",
        mode: "attach",
      }),
      { type: "target", id: burpee.id },
    );
    expect(spanAt(picked, "90")).toMatchObject({ attachedTo: burpee.id });
    expect(picked.picking).toBeUndefined();

    const removed = editorReducer(picked, { type: "remove", id: burpee.id });
    expect(spanAt(removed, "90")).not.toHaveProperty("attachedTo");
    expect(spanAt(removed, "12")).not.toHaveProperty("attachedTo");
  });

  it("ignores a whitespace-only selection and trims the edges of a real one", () => {
    const state = start();
    expect(editorReducer(state, { type: "tag", start: 1, end: 2, choice: { tag: "part" } })).toBe(
      state,
    );
    const range = at(state, "Amrap 15");
    const tagged = editorReducer(state, {
      type: "tag",
      start: range.start - 1,
      end: range.end + 1,
      choice: { tag: "block" },
    });
    expect(spanAt(tagged, "Amrap 15")).toMatchObject({
      _tag: "block",
      format: "amrap",
      params: { durationSeconds: 900 },
    });
  });
});
