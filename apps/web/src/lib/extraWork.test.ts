import { MovementId, deriveSession, makeMovementMatcher, suggestSpans } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { editorReducer, initialEditorState, type EditorState } from "./importEditor.ts";

const CATALOG = [
  { id: MovementId.make("clean"), name: "Clean", aliases: [] },
  { id: MovementId.make("jerk"), name: "Jerk", aliases: [] },
  { id: MovementId.make("clean-and-jerk"), name: "Clean and jerk", aliases: [] },
  { id: MovementId.make("pull-up"), name: "Pull-up", aliases: [] },
  { id: MovementId.make("back-squat"), name: "Back squat", aliases: [] },
];
const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;

const ORG = `** Session 170 <2026-11-02 ma>
**** Workout #1
- Every 90 sec x 5
- 2 Cleans
*** Notes
- Felt fast today`;

const PLAIN = `Workout
Every 90 sec x 5
2 Cleans`;

const open = (text: string) => {
  let next = 0;
  return initialEditorState({ text, spans: suggestSpans(text, matcher, () => `s${++next}`) });
};

const add = (state: EditorState, typed: string) =>
  editorReducer(state, { type: "addExtra", typed, matcher });

/** Each part's title with its items as "movement: performed sets". */
const protocol = (state: EditorState) =>
  deriveSession({ text: state.text, spans: state.spans }, nameOf).parts.map((part) => ({
    title: part.title,
    items: part.blocks.flatMap((block) =>
      block.items.map(
        (item) =>
          `${item.movementId}: ${item.performed.map((set) => `${set.reps}x${set.loadKg}`).join(" ")}`,
      ),
    ),
  }));

describe("appendExtraWork", () => {
  it("adds the lines under an extra part in the paste's style, lifted as written", () => {
    const before = open(ORG);
    const after = add(before, "Clean & jerk 1x1 @ 100 kg");
    expect(after.text).toBe(`${ORG}\n\n**** Extra work\n- Clean & jerk 1x1 @ 100 kg`);
    // What was there keeps its marks where they were.
    expect(after.spans.filter((span) => span.start < ORG.length)).toEqual(before.spans);
    expect(protocol(after)).toEqual([
      { title: "Workout #1", items: ["clean: "] },
      { title: "Extra work", items: ["clean-and-jerk: 1x100"] },
    ]);
    const selected = after.spans.find((span) => span.id === after.selectedId);
    expect(selected && after.text.slice(selected.start, selected.end)).toBe("Clean & jerk");
    expect(deriveSession({ text: after.text, spans: after.spans }, nameOf).notes).toBe(
      "Felt fast today",
    );
  });

  it("keeps adding to the extra part that ends the text", () => {
    const after = add(add(open(PLAIN), "Back squat 3x1 @ 140 kg"), "- 1 Clean and jerk 100 kg");
    expect(after.text).toBe(
      `${PLAIN}\n\nExtra work\nBack squat 3x1 @ 140 kg\n1 Clean and jerk 100 kg`,
    );
    expect(protocol(after).at(-1)).toEqual({
      title: "Extra work",
      items: ["back-squat: 1x140 1x140 1x140", "clean-and-jerk: 1x100"],
    });
  });

  it("leaves a line without reps or a load for the result form", () => {
    const after = add(open(PLAIN), "Clean and jerk 100 kg\n\n10 Pull-ups");
    expect(protocol(after).at(-1)).toEqual({
      title: "Extra work",
      items: ["clean-and-jerk: ", "pull-up: "],
    });
    expect(add(after, "  \n ")).toBe(after);
  });
});
