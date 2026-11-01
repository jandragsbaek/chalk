---
version: 1
slug: "apps-web-src-routes-import-tsx"
primary_target: "apps/web/src/routes/import.tsx"
related_targets: ["apps/web/src/routes/__root.tsx", "apps/web/src/routes/workouts.tsx"]
---

# Import: session import workbench and shell

Scope: the app shell (header band), workouts list (`/workouts`), Import route and its components;
shared tokens in packages/ui/theme.css. Formerly the separate backoffice app. Mode: Operate.

Audience/job: Jan alone, at a desktop, importing ~170 org-mode sessions one paste at a time.
Top priority (confirmed): confidence the structure is right before saving, then keyboard speed.
User verdict on the old UI: card soup, generic type and colour, awkward stacking (tag bar over
the text), cheap pastel highlights.

## Direction contract

THESIS: The import screen is a weightlifting meet protocol being filled in: the typed session on
one side, the official protocol on the other, a referee panel deciding when it may be saved.
Refuses the category default of rounded white cards on grey with one orange button.

OWN-WORLD: Cool photocopy-white paper, blue-black ink, one official red for no-lifts and
destructive actions only. Carbonless-copy tints (blue, green, canary, pink) tag movements and
numbers. Square corners, 1px ruled form lines, boxed fields with small condensed caps labels in
the box corner. Archivo (width axis) for UI, condensed caps for labels and titles; Courier Prime
for the typed source text. Tabular numerals everywhere. Dark: carbon ground, paper ink.

STORY: Paste, see the protocol fill itself in, fix what the jury flags, get three white lights,
save, next. Mistakes are visible before saving.

FIRST VIEWPORT: Ink header band (wordmark, tabs). Below it a protocol header strip of boxed
fields: session no., date, kind, parts, items, lift sets; referee lights and Save on the right.
Three columns at 1440: source text with line gutter and docked tag keys; protocol table (parts,
blocks, movement rows with set boxes, results, jury notes); inspector for the selected mark.

FORM: Meet protocol sheet, position 1 on the ordered list (taken as IMPECCABLE'S PICK). seed:45c529bb94b54466
Kept: stroke form carries state (dashed = unresolved, solid = resolved, doubled = selected);
empty cells print an em dash; line gutter with issues pointing at L-numbers; rows an edit
changed stay lit briefly; ink action colour only on pressables.
Signature move: referee lights, three lamps (date, movements, numbers) white for good, red for
no-lift; all white enables Save.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Class days rail (2026-11-01)

Decided with Jan: the backlog of ~170 class days from bookingboard lives as a register rail on
the left of /import (desk like /workouts), oldest first; saving a day picked there pulls the next
day to log and focuses the text. Keyboard: arrows walk, Enter pulls, S skips, Ctrl+Enter
suggests marks. Imported follows the form in the main column.
