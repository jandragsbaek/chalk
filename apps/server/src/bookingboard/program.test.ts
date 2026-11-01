import { describe, expect, it } from "@effect/vitest";

import { boxLocal, programText, tokenExpiry } from "./program.ts";

// Class 1399346 (2026-10-30) as bookingboard serves it.
const SNATCH_EMOM_WORKOUTS = [
  {
    title: "Workout #1",
    text: "<p>Every 90 sec x 8&nbsp;</p><p><br></p><p>1 Snatch pull + 1 snatch + 2 overhead squat&nbsp;</p><p><br></p><p>*Byg til en moderat vægt. Teknik frem for vægt. </p>",
    description: "<p>ignored while text has something</p>",
  },
  {
    title: "Workout #2",
    text: "",
    description:
      "<p>EMOM 16&nbsp;</p><p>1) 18-15/15-12 cal row (max 50 sec)&nbsp;</p><p>2) 12 Burpee over rower</p><p>3) 3 squat snatch @75% of 1 RM</p><p>4) Rest&nbsp;</p><p><br></p><p>*Inspiration fra Prepared programning</p>",
  },
];

describe("programText", () => {
  it("writes a class's program as plain text, a title on top of each workout", () => {
    expect(programText(SNATCH_EMOM_WORKOUTS)).toBe(`Workout #1
Every 90 sec x 8
1 Snatch pull + 1 snatch + 2 overhead squat
*Byg til en moderat vægt. Teknik frem for vægt.

Workout #2
EMOM 16
1) 18-15/15-12 cal row (max 50 sec)
2) 12 Burpee over rower
3) 3 squat snatch @75% of 1 RM
4) Rest
*Inspiration fra Prepared programning`);
  });

  it("keeps the coach's lines as typed, reads entities and list markup, and names an untitled workout", () => {
    expect(
      programText([
        {
          title: " ",
          text: "<ul><li>- 5 Back squats &amp; 10 push&#45;ups</li><li>• R&oslash;d&nbsp;&#x2F;&nbsp;bl&aring;</li></ul>Line<br/>break",
        },
      ]),
    ).toBe("Workout #1\n- 5 Back squats & 10 push-ups\n• Rød / blå\nLine\nbreak");
  });

  it("is empty for a class without a program, like open gym", () => {
    expect(programText([])).toBe("");
    expect(programText([{ title: "Workout #1", text: "<p>&nbsp;</p>", description: null }])).toBe(
      "",
    );
  });
});

describe("boxLocal", () => {
  it("reads instants in box time on both sides of the October clock change", () => {
    expect(boxLocal("2026-10-20T17:30:00+00:00")).toEqual({ date: "2026-10-20", time: "19:30" });
    expect(boxLocal("2026-10-26T15:30:00+00:00")).toEqual({ date: "2026-10-26", time: "16:30" });
    expect(boxLocal("2026-10-30T15:30:00+01:00")).toEqual({ date: "2026-10-30", time: "15:30" });
    expect(boxLocal("2026-10-30T23:30:00+00:00")).toEqual({ date: "2026-10-31", time: "00:30" });
  });
});

describe("tokenExpiry", () => {
  const jwt = (claims: object) =>
    `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

  it("reads a JWT's exp, and nothing from what is not one", () => {
    expect(tokenExpiry(jwt({ exp: 1_796_040_395 }))).toBe("2026-11-30T12:06:35.000Z");
    expect(tokenExpiry(jwt({ sub: "x" }))).toBeUndefined();
    expect(tokenExpiry("not-a-token")).toBeUndefined();
    expect(tokenExpiry("a.%%%.b")).toBeUndefined();
  });
});
