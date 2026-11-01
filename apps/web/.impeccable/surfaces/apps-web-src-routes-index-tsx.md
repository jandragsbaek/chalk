---
version: 1
slug: "apps-web-src-routes-index-tsx"
primary_target: "apps/web/src/routes/index.tsx"
related_targets: ["apps/web/src/routes/log.tsx", "apps/web/src/routes/__root.tsx"]
---

# Today: the dashboard at `/`

Scope: the front page (`/`, tab "Today") and the move of the manual log page to `/log`. Mode: Operate.

Audience/job: Jan alone, at a desk after training. Questions, in order:
did I show up this week, how consistent is the year, what got stronger, what did I do lately, log the next one.
Confirmed: heatmap shade = sessions per day (workouts plus strength-only days); panels = consistency numbers,
recent PRs, main-lift e1RM, latest sessions; logging moves to its own /log tab, linked by a primary action.
Data: client-only from existing RPCs (workouts, lift sets, rep maxes, benchmark results). No server change.

## Direction contract

THESIS: The athlete's card at the scorer's table: this week's entries in a column beside the season's record.
Refuses the category default of a KPI tile row over a chart grid in rounded cards.

OWN-WORLD: Inherits the meet protocol: photocopy paper, blue-black ink, copy tints only on tagged data
(blue movements, canary loads, goldenrod scores), square ruled boxes, condensed caps on 2px ink rules.
Heatmap is one ink hue, paper to ink, empty days printed as boxed cells.

STORY: See the week at a glance, read the year's density, spot what's new (PRs), check lift trends, log.

FIRST VIEWPORT: Ink band with Today tab. Left 20rem fresh-sheet column: week title on ink rule, Mon to Sun
day rows with that day's sessions, today double-outlined, 2x2 field boxes (this week vs last, 30 days, run
of weeks, best run), Log session primary. Right: "N days trained" title, year grid full width with month and
day labels and legend; Recent PRs and Main lifts side by side; Latest sessions below.

FORM: This week column + year field, position 6 on the ordered list (dealt). seed:bbf66deb6d678b33
Signature move: the year grid and the week column share one cell vocabulary; hovering/focusing a grid
cell names the day and its sessions; the current week's column in the grid is the left column, mirrored.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
