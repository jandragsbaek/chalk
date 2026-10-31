# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: Jan, who trains CrossFit at a box and logs every session. Uses the web app to log
workouts and strength sets, and the backoffice at a desktop for admin work, mainly importing
roughly 170 past sessions from org-mode text, one paste at a time.

## Product Purpose

Chalk tracks CrossFit sessions as compositions of known movements rather than free text, plus
strength numbers (rep maxes, estimated 1RM over time), so progress per movement is visible and a
coach (human or agent) gets structured data. Success: every past session imported correctly, and
logging new ones is fast.

## Positioning

A personal, structured training log: the whiteboard becomes data (parts, blocks, movements,
prescriptions, lift sets), not a notes field. The importer treats pasted text as the source of
truth and lets the user correct highlights until the structure reads like the whiteboard.

## Operating Context

- Box whiteboard vocabulary: AMRAP, EMOM, for time, rounds, Rx, M/F loads, % of 1RM, DU, T2B.
- Source material: org-mode notes (`** Session 167 <2026-10-28 on>`, `**** Workout #1`,
  `*** Notes` with results like "Back squat 1RM: 150 kg"), mixed English and Danish.
- Backoffice is repetitive bulk work: paste, review suggestions, correct, save, next. Keyboard
  shortcuts matter.

## Capabilities and Constraints

- Monorepo: `apps/web` (user app), `apps/backoffice` (admin), `apps/server`, shared
  `packages/contracts` and `packages/ui` (shadcn on Base UI, tokens in `theme.css`, shared by
  both apps).
- Backoffice: workouts list with search and stats; session import workbench (highlight text,
  tag with keys, pick/create movements, aliases learned, live structured preview, issues, save
  with conflict/replace); imported sessions list.
- Lint constraints: kit components are not restyled via className (layout only); no raw colors
  or arbitrary Tailwind values in class lists; tag colors and custom styling go through data
  attributes in CSS.
- Light and dark follow `prefers-color-scheme`.

## Brand Commitments

Name "Chalk". Nothing else is binding (colors, font, icon free to change, confirmed 2026-10-31).

## Evidence on Hand

Real session pastes in `packages/contracts/src/sessionImport/fixtures/sessions.ts`. No users,
testimonials or marketing claims exist; none should be invented.

## Product Principles

1. The text is the truth; structure is derived from it and always traceable back to it.
2. Bulk work should feel fast: keyboard first, sensible suggestions, few clicks per session.
3. Correctness over cleverness: problems are shown plainly and block saving only when real.
4. Personal tool: no onboarding fluff, dense where density helps.
