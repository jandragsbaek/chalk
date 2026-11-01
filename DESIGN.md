---
name: Chalk
description: A personal training log whose screens are filled in like a weightlifting meet protocol.
colors:
  background: "oklch(0.975 0.005 255)"
  foreground: "oklch(0.22 0.03 262)"
  card: "oklch(0.995 0.002 255)"
  muted: "oklch(0.945 0.008 255)"
  muted-foreground: "oklch(0.46 0.022 262)"
  border: "oklch(0.86 0.012 262)"
  input: "oklch(0.72 0.02 262)"
  ring: "oklch(0.5 0.16 262)"
  primary: "oklch(0.22 0.03 262)"
  primary-foreground: "oklch(0.985 0.004 255)"
  destructive: "oklch(0.53 0.2 27)"
  band: "oklch(0.22 0.03 262)"
  band-foreground: "oklch(0.975 0.005 255)"
  band-muted: "oklch(0.74 0.025 262)"
  copy-blue: "oklch(0.9 0.05 245)"
  copy-blue-ink: "oklch(0.5 0.13 255)"
  copy-green: "oklch(0.91 0.06 155)"
  copy-green-ink: "oklch(0.5 0.11 155)"
  copy-canary: "oklch(0.94 0.1 100)"
  copy-canary-ink: "oklch(0.58 0.12 85)"
  copy-pink: "oklch(0.9 0.06 350)"
  copy-pink-ink: "oklch(0.53 0.15 350)"
  copy-goldenrod: "oklch(0.89 0.08 70)"
  copy-goldenrod-ink: "oklch(0.56 0.12 60)"
  copy-grey: "oklch(0.92 0.01 262)"
  copy-grey-ink: "oklch(0.5 0.02 262)"
  lamp-good: "oklch(0.99 0.003 255)"
  lamp-fail: "oklch(0.6 0.22 27)"
  lamp-off: "oklch(0.34 0.025 262)"
  level-f: "oklch(0.87 0.018 262)"
  level-s: "oklch(0.76 0.03 262)"
  level-i: "oklch(0.62 0.05 262)"
  level-rx: "oklch(0.44 0.06 262)"
  level-e: "oklch(0.26 0.035 262)"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 70"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 70"
  field-entry:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 87.5"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 75"
  source:
    fontFamily: "Courier Prime, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.75rem"
rounded:
  none: "0px"
  lamp: "9999px"
spacing:
  hairline: "2px"
  xs: "4px"
  cell-y: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  band: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  button-sm:
    height: "32px"
    padding: "0 12px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "36px"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  badge-muted:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  header-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-foreground}"
    height: "{spacing.band}"
    padding: "0 24px"
  nav-tab:
    textColor: "{colors.band-muted}"
    typography: "{typography.body}"
    height: "{spacing.band}"
    padding: "0 12px"
  nav-tab-active:
    textColor: "{colors.band-foreground}"
  field-box:
    backgroundColor: "{colors.card}"
    typography: "{typography.field-entry}"
    padding: "6px 12px"
  attempt-box:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.none}"
    padding: "2px"
  chip-movement:
    backgroundColor: "{colors.copy-blue}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
  lamp:
    backgroundColor: "{colors.lamp-off}"
    rounded: "{rounded.lamp}"
    size: "14px"
---

# Design System: Chalk

## Overview

**Creative North Star: "The Meet Protocol Sheet"**

Every Chalk screen is an official weightlifting meet protocol being filled in. Cool photocopy-white paper, blue-black ink, a single official red for no-lifts, and carbonless-copy tints (blue, green, canary, pink, goldenrod) that tag data the way the duplicate sheets of a form are colour-coded. Structure comes from ruled 1px form lines and square boxes, each with a small condensed caps label printed in its corner. Nothing floats, nothing is rounded, nothing glows. Dark mode is the carbon side of the same form: a dark carbon ground with paper-coloured ink, the copy tints deepened rather than inverted.

The density is a working form, not a brochure. Panes are separated by rules, not gutters. Tables run edge to edge with tight 6px cell padding. Numbers are tabular everywhere, so columns of reps and loads align like handwritten entries in printed boxes. State is carried by stroke form as well as hue (solid edge resolved, dashed open, double outline selected), so a photocopy in greyscale would still read.

The world refuses the category default of rounded white cards on grey with one bright accent button. Ink fill is reserved for things you press and for the structural rules of the form; colour is reserved for tagged data and for the official no-lift red.

**Key Characteristics:**

- Cool paper ground, blue-black ink, hue 255 to 262 across every neutral.
- One red (destructive) for no-lifts, flagged lines and destructive actions only.
- Carbonless-copy tint pairs: a pale fill edged by a 2px ink underline of the same hue.
- Square corners (0px) on every box, button, field and badge; only referee lamps are round.
- Archivo on its width axis: condensed heavy caps for titles, condensed caps for labels.
- Courier Prime for typed source text and its echoes.
- Stroke form carries state: solid, dashed, double.
- Flat paper; depth from rule weight and tone, not shadow.

## Colors

A cool, near-monochrome paper-and-ink palette whose only saturated colours are the official red and the carbonless-copy tints that tag data.

### Primary

- **Blue-Black Ink** (oklch(0.22 0.03 262), `primary` and `foreground`): body text, primary button fill, the 2px underline beneath protocol section titles and page titles, part marks (ink block with paper text), the header band. In dark mode ink and paper swap: ink becomes paper-coloured (oklch(0.93 0.01 255)).
- **Ballpoint Blue** (oklch(0.5 0.16 262), `ring`): focus rings, the text caret and the 24% text-selection wash. Never a fill.

### Secondary

- **Official Red** (oklch(0.53 0.2 27), `destructive`): no-lift verdict text, flagged line numbers in the source gutter (solid red cell with paper numeral), issue markers, dashed outlines on unresolved protocol rows, destructive buttons. The red lamp uses the brighter **Referee Red** (oklch(0.6 0.22 27), `lamp-fail`).

### Tertiary

Carbonless copies. Each tint is a pair: a pale fill and the ink that edges it.

- **Copy Blue** (fill oklch(0.9 0.05 245), ink oklch(0.5 0.13 255)): movements, protocol movement rows, current picker option.
- **Copy Green** (fill oklch(0.91 0.06 155), ink oklch(0.5 0.11 155)): reps and sets.
- **Copy Canary** (fill oklch(0.94 0.1 100), ink oklch(0.58 0.12 85)): load, % of 1RM and RPE; also the flash fill that briefly lights a row an edit changed.
- **Copy Pink** (fill oklch(0.9 0.06 350), ink oklch(0.53 0.15 350)): time, distance, calories.
- **Copy Goldenrod** (fill oklch(0.89 0.08 70), ink oklch(0.56 0.12 60)): scores and results; the goldenrod underline on result boxes.
- **Copy Grey** (fill oklch(0.92 0.01 262), ink oklch(0.5 0.02 262)): untyped or default tags (date, session, notes) and the coach's intent lines, as marks and as protocol rows.

### Neutral

- **Photocopy Paper** (oklch(0.975 0.005 255), `background`): page ground, pane headers.
- **Fresh Sheet** (oklch(0.995 0.002 255), `card`): the writing surface: source pane, protocol header strip, fields, attempt boxes, outline buttons.
- **Ruled Tint** (oklch(0.945 0.008 255), `muted`): block header strips in the protocol, hover wash on ghost and outline controls.
- **Pencil Grey** (oklch(0.46 0.022 262), `muted-foreground`): printed labels, meta text, line numbers.
- **Form Rule** (oklch(0.86 0.012 262), `border`): every 1px ruled line and divider.
- **Box Edge** (oklch(0.72 0.02 262), `input`): field and attempt-box strokes, key caps, scrollbar thumb. Stronger than a rule because you write inside it.
- **Header Band** (oklch(0.22 0.03 262), `band`, with `band-foreground` and `band-muted` oklch(0.74 0.025 262)): the printed title block across the top; darker carbon (oklch(0.11 0.012 262)) in dark mode.
- **Lamp Off** (oklch(0.34 0.025 262)) and **Lamp White** (oklch(0.99 0.003 255)): referee lamp states.

- **Level Ramp** (`level-f` oklch(0.87 0.018 262) to `level-e` oklch(0.26 0.035 262)): one ink
  hue, light to dark, Fundamentals, Scaled, Intermediate, RX, Elite. Each step has its text
  token (`level-*-ink`): ink on F, S and I, paper on RX and E. On the carbon side the ramp runs
  the other way (Elite lightest), so the highest level is always the most ink.

- **Heat Ramp** (mixed from `foreground` into `card`, not separate tokens): training days by
  sessions, the same one-hue logic as the level ramp. None is a fresh-sheet box with a 1px
  form-rule edge; one session is 30% ink, two 62%, three or more solid ink. A day still to come
  prints nothing. On the carbon side the mix runs toward paper, so more sessions is still more ink.

### Named Rules

**The One Red Rule.** Red means no-lift: a failed check, a flagged line, an unresolved row, a destructive action. It is never a brand accent, a highlight or a decoration.

**The Carbon Copy Rule.** A tint never appears alone. Every tagged fill is edged by its own ink (a 2px inset underline, a 1px outline, or a dotted underline), and tints are spent only on tagged data, never on panels or decoration.

**The Ink Pressable Rule.** Solid ink fill on the page means "press this" (primary button, primary badge), a structural element of the form (header band, part marks, lamp housing) or the top step of an ink data ramp (level, heat). It is never used as a decorative panel.

## Typography

**Display Font:** Archivo Variable, width axis (with ui-sans-serif, system-ui)
**Body Font:** Archivo Variable (with ui-sans-serif, system-ui)
**Label/Mono Font:** Courier Prime 400/700 for typed source (with ui-monospace, Menlo)

**Character:** One grotesque stretched across its width axis does all the printed work: heavy condensed caps for the form's titles, narrow caps for the labels in the box corners, normal width for entries. Courier Prime is the typewriter that filled the form in.

### Hierarchy

- **Display** (750, 2.25rem, line-height 1, 70% width, uppercase, 0.01em): page titles ("Workouts", "Import a session"), always sitting on a 2px ink rule.
- **Headline** (750, 1.875rem, 70% width, uppercase): the session title in the protocol header strip. The wordmark uses the same style at 1.5rem.
- **Title** (750, 1.25rem, 70% width, uppercase): protocol section headings (Workout #1, Results) over a 2px ink rule; 1rem for small sub-sections ("To fix").
- **Field Entry** (600, 1.125rem / 1.75rem, 87.5% width, tabular): the value in a protocol header box.
- **Body** (400 to 600, 0.875rem / 1.25rem, tabular): table cells, rows, controls, buttons (600). Meta text drops to 0.75rem in pencil grey. Prose blocks cap at 65ch.
- **Label** (600, 0.6875rem / 1rem, 75% width, uppercase, 0.06em): the printed label in a box corner, column heads, pane titles, right-aligned meta counts, lamp initials.
- **Source** (Courier Prime 400, 1rem / 1.75rem): the pasted session text; bold Courier for raw span text echoed in the protocol, inspector and tag bar; key caps at 0.6875rem.
- **Nav / block headings** (600 to 700, 0.875rem, uppercase, 0.025em, condensed): header tabs and protocol block names.

### Named Rules

**The Printed Label Rule.** Condensed caps labels belong to a box, a column or a pane: in a box's corner, heading a table column, titling a pane, or as right-hand meta. They never float above a heading as a decorative eyebrow.

**The Tabular Everywhere Rule.** Tabular numerals are on at the body (`tnum`), so every count, load and date aligns in its column.

**The Typed Source Rule.** Courier Prime is only for text the user typed or pasted, its echoes elsewhere, line numbers and key caps. Interface copy is never set in it.

## Layout

Chalk is desktop-only: layouts target desktop browser widths.

The app is a form under a header band. A sticky 48px ink band carries the wordmark and uppercase tabs; a 2px paper-coloured underline marks the active tab. Below it, list and entry pages sit in a centred column (max 72rem for lists, 80rem for the paste page) with a 24px gutter and 32px top padding; the paste page splits 3:2.

The import workbench owns the viewport below the band (100dvh minus 48px) and its panes scroll independently. A protocol header strip of boxed fields runs across the top, boxes divided by 1px vertical rules, referee panel and actions pushed right. Below it, three columns divided by rules: source and protocol as equal fractions, inspector fixed at 18rem (22rem from 80rem).

Pane headers are 36px strips with a label on the left and meta on the right. Rows use 16px horizontal and 6px vertical padding; protocol rows align on a 13rem name column. The source pane prints a 2.25rem line-number gutter behind a 1px rule, text indented 3.25rem.

The front page (Today) lays out its own two columns under the band: a 20rem fresh-sheet week column, ruled off on its right and sticky below the band, beside a paper field padded 32px whose sections stack 40px apart. Recent PRs and Main lifts sit side by side from 80rem, 32px apart. The year grid keeps a 44rem minimum; in a narrower window it scrolls sideways under a sticky weekday label column.

The Workouts page (the session register) owns the viewport below the band like the import
workbench, in three ruled columns that scroll on their own: an 8.5rem month rail, a 27.5rem
register, and the open session's sheet in the rest.

Record lists that sit side by side share a 56px row so their rules line up: the Recent PRs list and the Main lifts table. Week day rows are at least 48px.

Spacing steps observed: 2px, 4px, 6px, 8px, 12px, 16px, 24px; 48px for the band.

## Elevation & Depth

The system is flat paper. Depth comes from rule weight (1px form rules, 2px ink rules under titles, a 4px ink top edge on dialogs), from tone (ruled tint strips behind block headers, the fresh-sheet card against the paper ground) and from the ink band. Inset box-shadows appear throughout, but as ink strokes (tag underlines, outlines, the goldenrod result line), never as lift.

### Shadow Vocabulary

- **Overlay lift** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): the alert dialog only, over a 35% ink scrim. The one thing that leaves the page.
- **Lamp bulb** (`box-shadow: inset 0 -0.125rem 0.1875rem oklch(0 0 0 / 0.35)`): the inner curvature of a referee lamp.

### Named Rules

**The Paper Flat Rule.** Surfaces at rest cast no shadow. A box is distinguished by its stroke and its tone, not by hovering. Only a modal dialog lifts.

## Shapes

Square everywhere. The radius token resolves to 0px for buttons, fields, badges, key caps, attempt boxes and dialogs. The only round forms are referee lamps and the switch track, which are physical objects rather than parts of the form.

Strokes carry meaning. 1px rules divide; a 1px box-edge stroke means "write here"; 2px ink rules head sections. Key caps get a 2px bottom edge. Tag state uses stroke form: a solid ink edge for resolved, a 1.5px dashed outline for open or undecided, a 3px double outline for selected. Empty cells print a short horizontal rule (an em-dash length line) rather than staying blank.

### Named Rules

**The Stroke State Rule.** Solid means resolved, dashed means open, double means selected. Hue may reinforce state but never carries it alone.

## Components

### Buttons

Printed and decisive: square, semi-bold, no gradient.

- **Shape:** square corners (0px), 1px border always present so variants share a footprint.
- **Primary:** ink fill, paper text, 36px tall, 14px horizontal padding, 0.875rem semi-bold; small size is 32px and 0.75rem.
- **Hover / Focus:** primary fades to 85% ink; outline darkens its border to ink and takes the ruled tint; 150ms colour transitions. Focus is a 2px ballpoint ring offset 2px from the paper.
- **Outline:** fresh-sheet fill, box-edge stroke. The default for secondary actions (Cancel, Pick, New movement).
- **Ghost:** transparent border, ruled-tint hover; header actions with icons (Re-suggest, Start over).
- **Destructive / Ghost-destructive:** red fill for confirming a delete; pencil-grey ghost that turns red on hover for row-level delete.
- **Disabled:** 45% opacity, no pointer events.

### Chips (tag marks)

- **Style:** carbonless fill with a 2px inset ink underline of the same hue. Prescription chips sit inside attempt boxes in the protocol; marks sit inline in the Courier source.
- **Variants:** blocks are a 1px ink outline on no fill; parts are a solid ink block with paper text; scores carry a double underline; date, session and notes use a 2px dotted underline.
- **State:** hover or linked deepens the fill toward its ink (26%); open drops the fill for a 1.5px dashed outline; selected adds a 3px double outline offset 1px.

### Cards / Containers

- **Corner Style:** square (0px).
- **Background:** fresh sheet on photocopy paper; ruled tint for block header strips.
- **Shadow Strategy:** none (see The Paper Flat Rule).
- **Border:** 1px form rules between panes and boxes; sections close on a 2px ink rule.
- **Internal Padding:** 16px horizontal for rows and panes, 12px for header boxes.

### Inputs / Fields

- **Style:** fresh-sheet fill, 1px box-edge stroke, square, 36px tall, 10px horizontal padding, 0.875rem text. Native selects keep the platform picker.
- **Focus:** border turns ballpoint blue with a 2px ring at 30%.
- **Hover:** border darkens to ink.

### Navigation

- **Style:** 48px ink header band. Wordmark in headline caps, then the tabs (Today, Log, Strength, Benchmarks, Levels, Workouts, Import, Coach); Today is the front page, Log the manual entry page and Workouts the session register. Tabs are 0.875rem semi-bold uppercase, semi-condensed, band-muted at rest, paper on hover; the active tab is paper with a 2px paper bottom rule flush to the band edge.

### Protocol Field Box

The header strip of the form: a row of boxes divided by 1px rules, each with a corner label in pencil-grey condensed caps over a field-entry value (session no., date, kind, counts).

### Referee Lamps (signature)

Three 14px round lamps in an ink housing, each with its initial in condensed caps beneath. Off is a dark slate, good is white, no-lift is referee red; 200ms colour transition. Beside them a condensed bold caps verdict ("Good lift" in ink, "No lift" in red) and a one-line reason. All white enables Save.

### Protocol Rows and Attempt Boxes

Movement rows take the copy-blue tint on hover (55%) and selection (70% with a double ink outline inset 3px). An unresolved row takes a red dashed outline and a red tinted wash. Prescriptions sit in attempt boxes: a fresh-sheet cell with a 1px box-edge stroke holding one tagged chip per set. Results sit in a box with a 1px ink stroke and a 3px goldenrod underline. A row changed by an edit flashes canary for 900ms (disabled under reduced motion). A planned session's rows lead their level line with the plan in words: a 1px dashed input-grey box ("Planned 30 kg", still open), turning into a 1px solid ink box once it is recorded ("Done 30 kg, as planned"), per the Stroke State Rule. While planning or logging a plan, only the selected row draws its level ruler, the Source pane narrows to 2fr against the protocol's 3fr, and the inspector leads with the plan or "Done as", with the catalog fields folded under "Movement".

### Debrief

The protocol closes on a Debrief section (`f` jumps to it): rows of boxes with corner labels,
divided by rules. A scale is one joined row of square boxes on a box-edge stroke, the chosen one
in ink (the same vocabulary as the result-mode switch); a pointer click on the chosen box clears
it. The session RPE row is a ladder: boxes under the answer take the canary tint and ink, the
colour of every RPE. Limiters are printed check boxes (16px, box-edge stroke, ink fill with a
paper tick when checked) with a pencil-grey hint. "What the coach reads" echoes the answers as
sentences on a copy-grey fill with its ink underline, like other notes.

### Level Ruler

One row of GymDanmark's level sheet as a ruler (`LevelRuler` in `packages/ui`, styled by data
attributes in `theme.css`): five rungs at equal steps, F to E, each with its condensed caps
letter above and its load or variation below. Zones between rungs take the level ramp; a rung
the sheet leaves out is hatched; Elite, which Chalk writes itself, has a dashed tick. Markers
carry state by form: a solid ink square for what was done, a diamond for what the athlete can
do (copy green for reps, copy canary for an estimated 1RM), a dashed bracket with a faint ink
wash for what the box programmed. Labels truncate to their fifth of the ruler (container query),
and a labelled marker on a rung prints its number in place of the rung's. Under a variant
family, a share bar splits the reps by level in the ramp's fills. Level badges are square
condensed caps on the ramp, solid when done and dashed when asked for. Used on the web
`/levels` page (one row per family, tabs by group) and on importer protocol rows (small, no
labels) and in the inspector.

### Section Heads

A section of the field is titled like a protocol section: condensed heavy caps (title size, headline size for the year) on a 2px ink rule, with meta on the right in pencil-grey condensed caps, bottom-aligned. Meta is a count ("Latest 6"), a legend, or a link to the section's full page that ends in a 12px arrow (lucide `ArrowRight`) and turns ink on hover. The table below starts with a label-size column-head row, cells padded 12px by 6px, and an empty section prints one sentence on fresh sheet saying what will appear and how.

### Training Days (heat cells and week rows, signature)

One cell vocabulary shared by the year grid and the week column, shaded on the heat ramp. The year grid is 53 week columns of square cells 3px apart, Monday first, month labels over the columns and Mon, Wed, Fri on a label column; the legend runs Rest, four cells, 3+ sessions. The day being read takes the selection double outline (3px, offset 1px) and is read out in a sentence under the grid; pointing at a cell or walking the grid with the arrow keys moves it, and the grid takes a 2px inset ballpoint ring on keyboard focus.

The week column is the same days as a card: one ruled row per day, a 3.5rem stub with the weekday in condensed caps over the date and a 10px heat swatch, then the day's entries (workout name with its kind label, or movement chips for a strength-only day; "Rest", "Nothing logged yet" for today, or an empty-cell rule for days unknown or still to come). Today carries a 3px double ink outline inset 4px. The day being read in the grid fills its row with the ruled tint, and pointing at a row selects that day in the grid. Below the rows, the consistency numbers as a 2x2 of protocol field boxes and a full-width primary button.

### Session Register (rail, register, sheet)

Every training day as one list, read like a scorer's register beside the open protocol. The
month rail prints years in title caps and one tab per month with its count; a tab grows a step
per session (capped), so busy and quiet stretches read before you scroll. The month being read
is an ink tab with paper text; a tab jumps the register. Register rows (at least 48px) carry a
weekday/date stub in condensed caps over the day numeral, the session number in pencil grey (an
empty-cell rule without one), the name over kind and movements, and the score as a goldenrod
chip (a muted sets badge for a strength day). Month heads stick, in title caps on a 2px ink rule
with a count or "7 of 17" under a filter. The open row takes the ruled tint and the double
outline; up and down walk the register. The sheet is the protocol read back: a title row with
its actions, a strip of protocol field boxes, then the importer's protocol without its editing
affordances (rows do not tint or select), the debrief as the coach reads it, and typed notes in
Courier.

### Coach Conversation

`/coach` owns the viewport under the band: a 16rem fresh-sheet rail of conversations (pane
header "Conversations" with an outline New button; the open one on the ruled tint with the 3px
double ink outline inset 4px; one whose last message has no answer dashed in box edge), and a
centred 46rem column that scrolls above a composer docked on a 1px rule. A thread opens on a
strip of protocol field boxes (Started, Turns, Reads, Model) and its title in display caps on a
2px ink rule. Each turn is a protocol section: its number as an ink part mark, "You" or "Coach"
in condensed caps on a 2px ink rule, its time (and the coach's read count) as right-hand meta.
No bubbles, no avatars, no left/right alignment.

- **The athlete's words** are typed source: Courier Prime in a fresh-sheet box with a box-edge
  stroke, in the turn and in the composer. The composer's hints are pencil-grey sentences.
- **Receipts** (signature): every tool call the coach made, boxed under its heading as ruled
  rows: the receipt number (R1, R2, numbered across the thread) in a Courier gutter, the tool in
  semi-bold, what it asked for as carbon chips (movement in copy blue, benchmark in goldenrod,
  date range in copy grey), the answer right-aligned in pencil grey, then a chevron. Open, a row
  shows the rows the model saw as a label-headed table on the paper ground; implied rep maxes
  keep their `*` with a footnote; empty cells print the short rule. A read still running is
  dashed in box edge, a failed read dashed in official red (Stroke State Rule).
- **Citations**: "(R2)" in a reply prints R2 in bold Courier with a dotted underline; following
  it opens and scrolls to that receipt.
- **Stopped replies**: a read or step limit ends on a dashed box-edge note in pencil grey; a
  reply the model never gave is a no-lift, one red-dashed notice in official red.
- **Starter prompts** on a new conversation sit right above the composer, three questions
  grounded in the log.
- **Not set up** (no key on the server): the composer is replaced by a dashed notice naming the
  variable; saved threads stay readable and starter prompts dim to the disabled 45%.

### Source Line Gutter

Courier source with printed line numbers in a right-aligned 2.25rem gutter behind a 1px rule. A flagged line turns its number cell solid red with a paper numeral, matching the L-number cited in the issue list.

## Do's and Don'ts

### Do:

- **Do** keep every box, button, field and badge square (0px).
- **Do** pair every tint with its own ink edge (2px inset underline, outline or dotted underline).
- **Do** carry state in stroke form: solid resolved, dashed open (1.5px), double selected (3px).
- **Do** head sections with condensed heavy caps on a 2px ink rule.
- **Do** put condensed caps labels in a box corner, a column head or a pane title strip.
- **Do** print a short rule in empty cells instead of leaving them blank.
- **Do** use Courier Prime for pasted text and its echoes, Archivo for everything else.
- **Do** keep every neutral on the cool 255 to 262 hue so paper and ink stay one family.

### Don't:

- **Don't** use red for anything but no-lifts, flagged lines, unresolved rows and destructive actions.
- **Don't** spend copy tints on panels, backgrounds or decoration; they belong to tagged data.
- **Don't** round corners or add soft drop shadows to surfaces at rest; only the modal dialog lifts.
- **Don't** set a condensed caps label floating above a heading as an eyebrow.
- **Don't** use solid ink fill for a decorative panel; ink fill marks pressables, the form's structure and the top of an ink data ramp.
- **Don't** let hue alone carry a state.
