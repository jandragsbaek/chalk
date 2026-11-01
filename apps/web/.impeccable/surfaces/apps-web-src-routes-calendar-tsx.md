---
version: 1
slug: "apps-web-src-routes-calendar-tsx"
primary_target: "apps/web/src/routes/calendar.tsx"
related_targets: ["apps/web/src/routes/index.tsx", "apps/web/src/routes/__root.tsx"]
---

# Calendar: programmed training at `/calendar`

Scope: the Calendar page (tab "Calendar", after Today), plus programmed sessions in Today's week column. Mode: Operate.

Audience/job: Jan alone, at a desk. Main ritual: Sunday, review the week that ends and place next week's
programmed work around the box classes. Also: review a coach-drafted block (Smolov Jr, prehab) and put it in
the calendar; drag single sessions to other days as life moves (one session only, never the rest); tick
accessory/prehab lines; check lifts auto-done from logged sets. Blocks stack (a squat cycle and a prehab block
at once). Days show everything: logged sessions, box plans, programmed and draft sessions.
Data: RPC `blocks.*` / `sessions.*` plus existing workouts, lift sets, plans.

Locked by Jan: base "Two weeks + tray"; bring in the full-line detail panel, block lanes over the weeks, and
month grids in a rail. Not the separate review strip (last week's column is the review).

## Direction contract

THESIS: The Sunday desk: the week that ends and the week ahead as one ruled board, the season above it as a
ruler, drafts on a shelf below. Refuses the category default of a month grid of colored event pills.

OWN-WORLD: Inherits the meet protocol: paper, blue-black ink, 1px rules, square boxes, condensed caps labels.
Tints only on line data (blue movement, green sets × reps, canary % and kg). Stroke state: dashed = draft or
open drop target, solid = in calendar, double = selected/dragged. Referee lamps per session, in their ink housing: white done,
dark otherwise, with "Missed" or "Partly done" in words; red stays reserved for no-lifts and deletes.

STORY: Read last week's lamps, see where blocks run, drag next week's sessions into the right days, accept
the coach's draft, tick prehab as it happens.

FIRST VIEWPORT: Band with Calendar active. Left 16rem fresh-sheet rail (18rem from 2xl): this month and next as cell grids
(past heat, planned marks, the board's two weeks bracketed), then blocks with TM and progress; selecting a
session swaps the rail to its full lines. Right: title strip "Week 44 → 45" with prev/next; block lanes ruler
(12 weeks, board window double-bracketed); the board, this week (5fr, review) | next week (7fr, plan), day
columns of session cards; a drafts tray under it with Put in calendar.

FORM: two weeks + tray, position 4 on the ordered list (dealt), with parts from positions 5 and 7.
seed:ae815e5568ec6fca
Signature move: the lanes ruler is the season in miniature and the board its magnified window; dragging a
session leaves a dashed carbon at its origin and outlines the drop day dashed until it lands solid.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
