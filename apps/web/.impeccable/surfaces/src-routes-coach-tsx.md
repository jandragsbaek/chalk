---
version: 1
slug: "src-routes-coach-tsx"
primary_target: "src/routes/coach.tsx"
related_targets: ["src/routes/__root.tsx"]
---

# Coach (/coach)

Scope: new Coach tab. Operate mode. One athlete at the desk after training: asks open questions about training; later clears the check-in backlog (workouts without a debrief).

Phase 1 (core): open conversations with tool receipts. Phase 2: check-in rail group + structured question boxes that write the existing Debrief.

Model: OpenRouter via @effect/ai-openrouter, `OPENROUTER_API_KEY` + `CHALK_COACH_MODEL` (the default). The athlete picks the model per message from a short allowlist (`COACH_MODELS`): the model is a select inside the composer's privacy line ("Your log goes to [Claude Sonnet 5.5] through OpenRouter."), its popup a flat sheet on a 1px ink stroke listing label and price per million tokens. Each coach turn's meta names the model that wrote it ("Claude Haiku 5.5 · 3 reads · 16:45"), and the field-box strip's Model box shows the last one. Without a key the page says so; no hidden failure.

## Direction contract

THESIS: A coach conversation printed as a meet protocol, not a chat app. Each turn is a numbered protocol section on a 2px ink rule; the coach's reads are boxed receipt rows you can open. Refuses bubbles, avatars, left/right alignment and a hidden "thinking" trail.

OWN-WORLD: Chalk's paper and ink. Header band, fresh-sheet rail with ruled rows, dashed outline for open/waiting rows, ink inset bar for the selected one. Ink part marks (1, 2, 3) before "You"/"Coach". Athlete text in Courier Prime (typed source). Receipts: boxed rows with an R-number gutter in Courier, tool name semi-bold, carbon chips for movements/loads/reps, pencil-grey range on the right; a running receipt is dashed, a failed one red-dashed.

STORY: The athlete asks; sees exactly what the coach read before reading its answer; opens any receipt to check the numbers; trusts the reply because every claim cites (R2).

FIRST VIEWPORT: 16rem rail left (Conversations, New button). Centre 46rem column: field-box strip (Thread, Started, Reads, Model), thread title in display caps on a 2px rule, numbered sections, composer pinned under the column in Courier. Empty thread: composer leads with three data-grounded prompts.

FORM: fused card; protocol column (dealt 2) with the check-in queue's question boxes (dealt 5, phase 2). seed:cd52e659fbb4908a

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
