---
target: Import editor right half (protocol + selected mark inspector)
total_score: 20
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:/home/nayena/.t3/worktrees/chalk/t3-243c7b13/apps/web/src/components/import/SpanInspector.tsx"
target_fingerprint: "sha256:56c091c55b1db835b79e4dc36e810fb526aa1db188d7ffda3e47f904a98685d7"
target_path: /home/nayena/.t3/worktrees/chalk/t3-243c7b13/apps/web/src/components/import/SpanInspector.tsx
timestamp: 2026-11-01T22-52-45Z
slug: apps-web-src-components-import-spaninspector-tsx
---

# Critique: Import editor right half (Protocol + Selected mark inspector)

Method: dual-agent. Score 20/40 (Acceptable, low). Detector: 0 findings (18 files); overlay "No anti-patterns found".

Heuristics: 1:2 2:2 3:3 4:1 5:2 6:2 7:2 8:1 9:2 10:3. Cognitive load 7/8 fail.
Measurements: protocol 3.2x/4.1x viewport, 60 controls; inspector 16 controls; 84 uses of 11px; 55 uppercase micro-labels; contrast OK.

Root: outcomeFirst = planning || plan !== undefined (ImportWorkbench.tsx:154); paste mode misses outcome-first inspector order (SpanInspector.tsx:936) and rulerOnSelectedOnly (SessionProtocol.tsx:220).

## Priority issues

- [P1] Inspector opens on catalog admin, not logging; Done as at ~930px. Fix: outcome-first for all resolved movements; fold identity. /impeccable distill
- [P1] Two loads (Load used PerformanceEditor.tsx:319 vs Result Load ResultEditor.tsx:143); header shows 0 kg after 35 entered. Fix: one load, derive Fixed result; Ramp/Each set behind "Sets varied?". /impeccable clarify + distill
- [P1] Catalog writes (Core, Levels, Scales to) silent, styled as session fields, not undone by Start over. Fix: separate catalog box / one-time issue. /impeccable harden
- [P2] Protocol rows duplicate inspector: 9 rulers, level line every row. Fix: ruler on selected only; compact unselected rows. /impeccable distill
- [P2] Debrief full form in protocol scroll (~1000px, ~25 controls). Fix: Result/Minutes/RPE strip + disclosure. /impeccable layout

## Personas

Alex (bulk import): inspector scroll per row, no load key, no same-as-above, j/k unadvertised.
Sam (keyboard/SR): long tab path before Load; protocol rows are run-on button names; Pick name "Pick a".
Jan post-class: taxonomy before logging; result far below; ruler contradiction 35@F vs "Under the sheet".

## Minor

Repeated column-head row per part; parser 900 sec / 1 rep; "each round" on chipper; 115/85lbs unmarked; ruler label clamp (level-ruler.tsx:50); 4 targets <24px tall.
