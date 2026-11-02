---
target: Import editor right half after block result (PR 46)
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:/home/nayena/.t3/worktrees/chalk/t3-243c7b13/apps/web/src/components/import/SpanInspector.tsx"
target_fingerprint: "sha256:9997fe784321dea5f7819b323c4e947d676bd3d2f92c4b5ab821ebbe95ea3bd7"
target_path: /home/nayena/.t3/worktrees/chalk/t3-243c7b13/apps/web/src/components/import/SpanInspector.tsx
timestamp: 2026-11-01T23-19-49Z
slug: apps-web-src-components-import-spaninspector-tsx
---

# Critique: Import editor right half, after PR #46 (block result)

Method: dual-agent. Score 24/40 (was 20). Detector: 0 findings (source + CDP in-page, 2 widths); overlay clean.
Heuristics: 1:3 2:3 3:3 4:2 5:2 6:2 7:2 8:1 9:3 10:3. Cognitive load 6/8 fail.
Measures: protocol 3.2x/4.1x viewport (4.3x with result open), 60-65 controls, 84x 11px, 56 caps micro-labels; inspector 16 controls, 992/621 at 1440; contrast OK; 4 targets <24px tall incl "Result +" 71x18.
Result entry points for the for-time block: block Result strip, inspector Done as + Result (Fixed/Ramp/Each set), debrief Result + Minutes. Cap editable in 3 places.

## Priority issues

- [P1] Inspector leads with catalog admin; logging below fold. outcomeFirst gate ImportWorkbench.tsx:154 / SpanInspector.tsx:956. Fix: folded branch for resolved movements. /impeccable distill
- [P1] Done as + Result = two forms, load typed twice; Result form shown even in scored for-time blocks (SpanInspector.tsx:894). Fix: hide Result in score-bearing blocks; Done-as load drives tonnage. /impeccable distill
- [P1] "Result" means 3 things (block score, lift sets, debrief text); debrief "Use Capped · 113 reps" copies into free text; cap 3 editors; parser doesn't read Cap = N into cap on this text. Fix: Score / Sets lifted / In your words; one cap editor. /impeccable clarify
- [P2] Level line + ruler on every row; header level boxes. Fix: rulerOnSelectedOnly in import. /impeccable quieter
- [P2] Debrief long form at end of a 4-screen pane. Fix: RPE + notes default. /impeccable distill
  Block result: right owner of the score, well validated; but a 4th entry place, inline vs inspector inconsistency, doesn't inform movement rows, "Result +" small and far right.
