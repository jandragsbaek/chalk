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
- **Copy Grey** (fill oklch(0.92 0.01 262), ink oklch(0.5 0.02 262)): untyped or default tags (date, session, notes) and the coach's intent and comment lines, as marks and as protocol rows. A comment mark has no fill, only a thin dashed rule.

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

The Movements page (the catalog) uses the same three ruled columns: a 10rem rail, a 26rem
register, and the open movement's sheet in the rest.

The Calendar page owns the viewport below the band too: a fresh-sheet rail of 16rem (18rem from
the 2xl width) ruled off on its right, beside a column that stacks the title strip, the lanes
ruler, the board (taking the rest of the height) and the drafts tray; the rail and each week's day
columns scroll on their own, with thin box-edge scrollbars.

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
- **Offered:** a movement chip Chalk derives rather than one the athlete set (a scaling offered by the core movement or the level sheet) drops the fill for the same 1.5px dashed outline (`data-derived`).
- **Tail:** words the matcher left after a movement mark ("lateral over DB" after "Burpee") carry no fill, only a 1.5px dashed underline in movement ink, offset under the baseline: the mark may run on into a variation, still open. The tail belongs to its mark: it lights and selects with it (dashed outline when selected), and the protocol row prints it in Courier under the name with "variation?" in condensed caps.

### Cards / Containers

- **Corner Style:** square (0px).
- **Background:** fresh sheet on photocopy paper; ruled tint for block header strips.
- **Shadow Strategy:** none (see The Paper Flat Rule).
- **Border:** 1px form rules between panes and boxes; sections close on a 2px ink rule.
- **Internal Padding:** 16px horizontal for rows and panes, 12px for header boxes.

### Inputs / Fields

- **Style:** fresh-sheet fill, 1px box-edge stroke, square, 36px tall, 10px horizontal padding, 0.875rem text. Native selects keep the platform picker; a select whose rows need a note (the coach's model pick, label plus price) uses the popup `Select`: a fresh sheet on a 1px ink stroke, no shadow, highlighted row on the muted tint, a check at the current pick. A free-text field with suggestions (the Log page's workout name, Coached by, Place) uses `Autocomplete`: the same flat popup, as wide as the field, hidden while nothing matches; the workout picker splits it into a grouped list and the highlighted benchmark's board with your best.
- **Focus:** border turns ballpoint blue with a 2px ring at 30%.
- **Hover:** border darkens to ink.

### Navigation

- **Style:** 48px ink header band. Wordmark in headline caps, then the tabs (Today, Calendar, Plan, Log, Strength, Benchmarks, Levels, Movements, Power, Workouts, Import, Coach, Settings); Today is the front page, Calendar the programmed weeks, Log the manual entry page, Workouts the session register and Settings the athlete's profile. Settings carries its own tab strip under its title (Profile, Connections): condensed caps tabs on a 1px rule, the active one in ink with a 2px ink inset underline, like the level groups' tabs. Tabs are 0.875rem semi-bold uppercase, semi-condensed, band-muted at rest, paper on hover; the active tab is paper with a 2px paper bottom rule flush to the band edge.

### Protocol Field Box

The header strip of the form: a row of boxes divided by 1px rules, each with a corner label in pencil-grey condensed caps over a field-entry value (session no., date, kind, counts).

### Referee Lamps (signature)

Three 14px round lamps in an ink housing, each with its initial in condensed caps beneath. Off is a dark slate, good is white, no-lift is referee red; 200ms colour transition. Beside them a condensed bold caps verdict ("Good lift" in ink, "No lift" in red) and a one-line reason. All white enables Save.

### Protocol Rows and Attempt Boxes

Movement rows take the copy-blue tint on hover (55%) and selection (70% with a double ink outline inset 3px). An unresolved row takes a red dashed outline and a red tinted wash. Prescriptions sit in attempt boxes: a fresh-sheet cell with a 1px box-edge stroke holding one tagged chip per set. Results sit in a box with a 1px ink stroke and a 3px goldenrod underline. A complex (barbell movements on one line, one bar) joins its rows with a 2px ink bracket in the left gutter, dashed rules between them, and prints one "One bar" result box under them; selecting one row lights the others, and the inspector leads with the shared plan, load and result (reps typed "1 + 2"). A row changed by an edit flashes canary for 900ms (disabled under reduced motion). A planned session's rows lead their level line with the plan in words: a 1px dashed input-grey box ("Planned 30 kg", still open), turning into a 1px solid ink box once it is recorded ("Done 30 kg, as planned"), per the Stroke State Rule. Only the selected row draws its level ruler; other rows print a level line only when something was done or planned, with badges for the sides there are and no words for a missing one. The lead and the badges wrap as two units, never on a separator. In a for-time or AMRAP a row prints no "Lifted" box: what it lifted follows from its "Done" line, and the block header totals it. While planning or logging a plan the Source pane narrows to 2fr against the protocol's 3fr. Once a movement mark is resolved the inspector leads with the plan or "Done as", then "Sets lifted", with the picker and the catalog fields folded under "Movement"; in a for-time or AMRAP "Sets lifted" is a read-only line counted from the load and the block's score, not a form.

### Block Result

A scored block's header strip carries its score right after the title, where the whiteboard writes
it, in a 28px result box ("Score Capped · 113 reps"); with none yet it is an open box (1.5px dashed
ink) with "Score" and a plus. Scores marked in the text and what the block lifted sit at the right.
Logging, the time cap is set here only; the block inspector offers it while planning. Pressing
it opens a fresh-sheet strip under the header: the outcome switch ("Finished" or "Capped" for a
for-time, the result-mode switch's vocabulary), the fields for it, the cap in minutes, Clear and
Done, and one pencil-grey line saying how the score was counted. Enter or Escape closes it.

### Variation Ladder

The inspector leads with it while a movement mark has words left over. A label row ("Variation", and "left over" with the tail echoed in bold Courier on its dashed underline), then a ruled list closed top and bottom by 1px rules: one rung per variation of the core, at most eight, each a key cap (1 to 8) and the name with the words the leftovers matched in bold on a 2px copy-blue ink underline, the same ink as the mark they finish. The best fit is Chalk's offer, so it takes the open state: a 1.5px dashed movement-ink outline inset 3px and "Best fit" in condensed caps at the right. A dashed rule sets off the last rung, key 0, "Just <movement>". Rungs take the copy-blue wash on hover and the ballpoint ring on focus. Under the list, one pencil-grey line names the phrase the pick learns, and a ghost "None of these: pick or create one" opens the mark for the picker. A rung ranked by an alias rather than its name prints that alias after it in pencil-grey Courier, and "Best fit" appears only when one rung matched more of the words than any other. The catalog fields stay folded under "Movement" below it, as for any resolved movement. After a pick the ladder gives way to a receipt: a fresh-sheet box on a 1px ink stroke (resolved), "Learned" in condensed caps, the phrase in bold Courier, an arrow icon, the movement, and how many other lines it re-tagged; a phrase that could not be saved prints "Picked, not learned" on a 1.5px dashed box edge. Without leftovers, a movement with a family shows its other members as small outline buttons under the picker ("Also Burpee", five then "n more").

### Debrief

The protocol closes on a Debrief section (`f` jumps to it): rows of boxes with corner labels,
divided by rules. Open are the result, minutes, session RPE and notes; how it felt, could push,
what limited you and next time fold under "More for the coach", open once one has an answer. Once
a block is scored the result box echoes it ("Score Capped · 113 reps, as entered on the block")
instead of asking again; otherwise it is "In your words". A scale is one joined row of square boxes on a box-edge stroke, the chosen one
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

One cell vocabulary shared by the year grid and the week column, shaded on the heat ramp. The year grid is 53 week columns of square cells 3px apart, Monday first, month labels over the columns and Mon, Wed, Fri on a label column; the legend runs a rest-day cell, then None, four cells, 3+ sessions. A **rest day** (marked, never inferred) is a fresh-sheet box on a box-edge stroke struck through bottom-left to top-right by a 1.5px ink line, like a day crossed off a paper calendar; it prints on a day still to come too, so planned rest shows. Clicking a cell, or walking to it with the arrow keys, holds it in the readout (Escape lets go); a day with nothing logged gets a small `Select` at the readout's right, "Mark rest" or "Change" (Rest day, Sick, Injured, Travel, Not resting). The day being read takes the selection double outline (3px, offset 1px) and is read out in a sentence under the grid; pointing at a cell or walking the grid with the arrow keys moves it, and the grid takes a 2px inset ballpoint ring on keyboard focus.

Over the year grid, the **place tally**: one strip of protocol field boxes on fresh sheet, the
count kept for fun. "At the box" leads in display caps at 3.75rem with "sessions · 23 to No. 200"
in pencil grey beside it, ruled off by a 2px ink rule; then Home and Away (its label counting
the other boxes) in 2.25rem display caps, the empty-cell rule for none; then "Counted since"
with the month of the first session. Hidden until there is a session.

The week column is the same days as a card: one ruled row per day, a 3.5rem stub with the weekday in condensed caps over the date and a 10px heat swatch, then the day's entries (workout name with its kind label over its number at its place, "Box 179", right-aligned in condensed caps; or movement chips for a strength-only day, its number at the right; a marked rest day by its kind, with "By coach" in condensed caps when the coach put it there; "Nothing logged yet" for today, or an empty-cell rule for any other day with nothing logged or still to come). A row with nothing logged shows the same rest `Select` at its right while pointed at or focused. Today carries a 3px double ink outline inset 4px. The day being read in the grid fills its row with the ruled tint, and pointing at a row selects that day in the grid. Below the rows, the consistency numbers as a 2x2 of protocol field boxes and a full-width primary button.

### Class Days Rail (import backlog)

`/import` is a desk like `/workouts`: a 25rem rail of class days beside the paste box, each
scrolling on its own; Imported follows the form. The rail heads like a section ("Class days",
"Since Aug 22, 2025" as meta), then two protocol field boxes (To log, Logged "35 of 168") over a
6px progress rule (ink on the ruled tint). "Oldest to log" names the next day and its classes with
the primary Pull. The month tally is one column per month from the first class, one 6px bar per
class day stacked from the bottom, by stroke form: logged solid ink, still to log a 1px dashed
ink box on fresh sheet, skipped a pale box-edge box; month caps under the columns with the year
under August and January. The picked day's month takes the double outline; a column hovers to
the ruled tint and jumps the register there. Tabs in condensed caps (To log, All, Skipped, with
counts; the open one ink with a 2px ink underline) sit over the register: sticky month heads in
title caps on a 2px ink rule ("8 to log · 1 logged"), rows at least 48px with the weekday/date
stub and each class as "17:00 WOD · Rikke L.". A day to log ends in a 14px dashed ink box and a
ghost Skip that shows on hover, focus or pick; a logged day prints its session name over the
classes with one white lamp; a skipped day prints in pencil grey with Put back. The picked day
takes the ruled tint and the inset double outline. Arrow keys walk the days, Enter pulls, S
skips. The foot says when bookingboard was read, with a ghost Check now; a failed read is one
line in official red. With nothing to log, the three white lamps.

### Session Register (rail, register, sheet)

Every training day as one list, read like a scorer's register beside the open protocol. The
month rail prints years in title caps and one tab per month with its count; a tab grows a step
per session (capped), so busy and quiet stretches read before you scroll. The month being read
is an ink tab with paper text; a tab jumps the register. Register rows (at least 48px) carry a
weekday/date stub in condensed caps over the day numeral, the session's number at its place in
semi-bold over the place in condensed caps (Box, Home, Away), the name over kind and movements, and the score as a goldenrod
chip (a muted sets badge for a strength day). Month heads stick, in title caps on a 2px ink rule
with a count or "7 of 17" under a filter. The open row takes the ruled tint and the double
outline; up and down walk the register. The sheet is the protocol read back: a title row with
its actions, a strip of protocol field boxes (Session "No. 179" and Place first), then the importer's protocol without its editing
affordances (rows do not tint or select), the debrief as the coach reads it, and typed notes in
Courier.

### Movement Catalog (rail, register, sheet)

`/movements` reads the catalog like the session register reads sessions. The rail prints
"Category" and "Scalings" in title caps over ruled tabs with counts; the chosen tab is an ink
tab with paper text. Register rows (at least 48px) carry the name over its core, variations and
sheet row in pencil grey, and the movement's own scalings as copy-blue chips (two, then "+n"; an
empty-cell rule without any), under sticky category heads on a 2px ink rule; the open row takes
the ruled tint and the double outline, and up and down walk the register. The sheet is the
movement's protocol header (Core, Sheet row, In sessions, Done scaled), then sections under
section heads: Scales to (a numbered ruled list, first offered first, each with how often it
stood in and ghost up, down and remove buttons, an add select, then the dashed offered chips),
Scaled from (chips linking to the movements that offer this one), Variations (the family as a ruled list: core marked "Core" in condensed caps, each with its first two whiteboard phrases in bold Courier and "+n", the movement being read in the selection double outline), Aliases (Courier entries on a
dotted underline and an add field), and Core and levels (the importer's catalog fields). The
importer's inspector uses the same Scales to list.

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

### Calendar (board, lanes, rail, drafts)

`/calendar` is the Sunday desk: the week that ends and the week ahead as one ruled board, the
season above it as a ruler, drafts on a shelf below. No month grid of coloured event pills.

- **Title strip:** a row of protocol field boxes on fresh sheet, divided by 1px rules: "Week 44 →
  45" in headline caps, then "Week 44 done" (done of programmed, with "+ n logged" in pencil
  grey) and "Week 45 ahead" (programmed, "+ n box"), a status line that takes official red only
  for a failed save, and small outline buttons on the right (earlier, This week, later).
- **Lanes ruler** (signature): twelve week columns under 1px rules, "W44" in condensed caps with
  the month beside the week a month starts. Each block is a lane from its first session to its
  last: a fresh-sheet bar on a 1px ink stroke (1.5px dashed box edge for a draft) with its name
  set over the bar's top edge, and one tick per session along its foot (1px ink left edge, solid
  ink once done, 45% ink partly done). At most four lanes, then "+n more blocks". Today is a 2px
  ink rule down the lanes; the board's two weeks take the ruled tint under a 3px double ink
  bracket. A week column hovers to the ruled tint and moves the board there.
- **Board:** this week 5fr | next week 7fr, the plan week ruled off by a 2px ink rule. Each week
  heads like a section (title caps on a 2px ink rule, dates and "this week" as meta) over seven
  day columns divided by 1px rules: weekday label over the day numeral on a 1px rule, then what
  the day holds. Today's column takes the 3px double ink outline inset 4px. A past day with
  nothing prints the empty-cell rule; the rest pick sits at the column's foot, shown while the
  column is pointed at or focused.
- **Cards by stroke** (Stroke State Rule): a session in the calendar is a fresh-sheet box on a
  1px solid ink stroke, ruled tint on hover; a draft session is 1.5px dashed box edge; the open
  one adds the 3px double outline offset 1px. While dragged, the card stays at its origin as a
  dashed carbon at 45% opacity, and the day it would land on takes the ruled tint and a 1.5px
  dashed ink outline inset 3px. On landing the card flashes canary for 900ms, like an edited
  protocol row. A logged session is a plain ruled box (its name, a goldenrod score chip, a white
  lamp); a box plan keeps its dashed plan box with "Box plan" in condensed caps.
- **Plan-week cards:** the block's short name in condensed caps, the session title in semi-bold
  semi-condensed 0.75rem (two lines at most), its first two lines, then "+n more" and the state
  word ("Done", "Partly done", "Missed") with its lamp. Below the tall height (860px) a card
  prints one line and counts the second in "+n more", so the plan week fits the window.
- **Review-week cards are brief:** title and lamp only, the title condensed (semi-condensed from
  2xl); the lines open in the rail.
- **Lamps:** one 11px referee lamp in its ink housing at the card's foot, lit only for a
  scheduled session on or before today: white when done, lamp-off otherwise, the state carried by
  the word beside it. Red is never a missed session.
- **Line dose:** carbon chips after the movement name: sets × reps in copy green, the percent in
  copy canary, the load it comes to in plain semi-bold "kg", load in words in pencil grey; "each"
  prints outside the chip in pencil grey. On a card the dose is compact: reps chip and kg only.
- **Rest marks:** the rest-day box (struck through, as on Today) at 12px with one word in
  condensed caps (Rest, Sick, Injured, Travel), so the narrowest column prints it whole.
- **Rail at rest:** this month and next as month grids (month in title caps on a 2px ink rule,
  the year as meta), cells 28px tall, 2px apart, on the heat ramp with paper numerals on the two
  darkest steps and a 1px rule edge on days to come. A programmed day prints a 3px solid ink bar
  under its numeral, a draft day a 1.5px dashed one; the board's days take a 1px solid ink inset
  edge; today the double outline; hover a 1px ink outline. A legend of condensed caps reads
  Programmed, Draft, On the board. Below, the blocks in the calendar: name, span, a 6px progress
  bar (ink on the ruled tint), training maxes on a dotted box-edge underline that opens a small
  field, and a ghost-destructive remove.
- **Session detail:** selecting a card swaps the rail for the session: its title in 1.5rem
  display caps over a 2px ink rule with a ghost close, field boxes (Block, Day, Done), then one
  ruled row per line: the movement as a copy-blue chip, the full dose, and a printed check box to
  tick it (or "From your log" with a white lamp when the log already covers it). Training max
  fields, a Move to date field, and a ghost-destructive remove close it.
- **Drafts tray:** a fresh-sheet shelf on a 2px ink top rule, at most 18rem before it scrolls.
  One ruled row per draft: name in title caps with "Coach draft" in condensed caps beside it, a
  pencil-grey meta line (span, sessions, TM, goal), then an outline Sessions toggle, the primary
  "Put in calendar" and a ghost-destructive Discard. Folded out, the goal as prose and the
  sessions grouped under "Week n" labels as 9rem cards prefixed with their date, scrolling
  sideways, each draggable onto the board. With no drafts the tray is one sentence and an "Ask
  the coach" link ending in the 12px arrow.
- **On Today:** the week column lists a programmed session as its title, underlined in box edge
  and linking to it on the calendar, over its state word in condensed caps (Programmed, Partly
  done, Done, Missed).

### Connections

`/settings/connections` lists each outside service Chalk reads as a protocol section in one
48rem column: its name in title caps on a 2px ink rule, the host or what it feeds as meta. Under
it a strip of field boxes on fresh sheet opens on the **connection verdict**: one 14px referee
lamp in its ink housing, then the verdict in condensed bold caps over a one-line reason in
pencil grey. White is working (Connected, Synced), lamp-off is not set up, referee red is a
no-lift (Token expired, Read failed; the verdict takes official red too). The verdict box takes
the width the boxes beside it leave (participant, token expiry; weigh-ins, since, last read),
which never wrap. Below, a ruled row of the rule in words and small actions (outline Sync now
or Replace token, ghost New tokens, ghost-destructive Disconnect). Setup opens as ruled steps on
a 9.5rem printed label column ("1 · Log in", "2 · Paste tokens", "3 · Import"; the sequence is
real): a command in Courier on a paper box with a ghost Copy, the pasted token file in a Courier
textarea, the import day and the primary button. A failing connection reopens its setup under
the strip.

The bodyweight chart on Profile draws the 7-day trailing mean as its 2px ink line; scale readings
are 3px quiet squares under it, typed weigh-ins 6px ink squares, with a legend once scale data
is there and the range switch (90 days, 1 year, All) once the history is longer than 90 days.

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
