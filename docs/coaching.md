# Coaching loop (planned)

A short, bounded conversation after a workout: the coach looks at the data, asks a few relevant
questions, and leaves a note. Not a chatbot; a structured check-in.

## Shape of a session

1. **Trigger**: after logging a workout, or on demand from a workout or movement page.
2. **Gather**: the coach calls read tools: the workout just logged, recent sessions, rep maxes,
   weekly volume, scaling history for the movements involved.
3. **Ask**: at most three questions, returned as structured data, not prose:
   `CoachQuestion { id, text, kind: "scale" | "choice" | "text", options? }`.
   Examples: "Pull-ups were banded again; did the purple band feel too easy?", "That 5RM
   matched last month's. Sleep, or did the bar slow down at rep 4?", "RPE for the squats?"
4. **Answer**: the athlete answers in the UI (sliders and chips first, text optional).
5. **Note**: one final model turn produces
   `CoachNote { summary, suggestions[], flags[] }`, saved with the workout. Flags are for pain
   or injury mentions; the coach suggests seeing a professional and gives no medical advice.

Hard limits per session: tool calls (about 8), model turns (3), output tokens, and a wall-clock
timeout. A session that hits a limit ends with whatever note it has.

## Architecture

```
apps/web ── RPC coach.start / coach.answer ──> apps/server
                                                 CoachService
                                                   LanguageModel (OpenRouter)
                                                   Toolkit ── same handlers ──┐
apps/mcp (stdio | HTTP) ── McpServer ─────────────────────────────────────────┘
                              tools over WorkoutStore, StrengthStore, ...
```

- **One set of tools, two consumers.** Tools are Effect `Tool` definitions with Schema
  parameters and results, implemented once over the server's stores. The in-app coach uses them
  as a `Toolkit` with `LanguageModel`; the MCP server (`effect/ai/McpServer`) exposes the same
  handlers so Claude Code, Claude Desktop or any MCP client can query Chalk too.
- **MCP server**: a new `CHALK_MODE=mcp` (stdio) or `apps/mcp` package; same Layer graph as the
  API mode, different transport. Read-only tools first:
  - `list_workouts { from, to }`
  - `get_workout { id }`
  - `get_rep_maxes { movementId? }`
  - `list_lift_sets { movementId, from?, to? }`
  - `movement_volume { from, to, movementIds? }` (after the volume grid exists)
  - `scaling_history { movementId }` (after scaling exists)
  - Write tools later and narrowly: `save_coach_note { workoutId, note }`.
- **Model access**: OpenRouter through `@effect/ai-openrouter` (part of the Effect monorepo,
  versioned with `effect`; 4.1.1 released 2026-10-30, matching the `effect` 4.1 catalog pin).
  OpenRouter keeps the model a config value, so a small, cheap model can do the questions and a
  stronger one the note if needed.
- **Config**: `OPENROUTER_API_KEY` (server only, never sent to the browser, read with
  `Config.Redacted`), `CHALK_COACH_MODEL` (OpenRouter model slug). Coach RPCs answer with a typed
  `CoachUnavailableError` when the key is unset, and the UI hides the coach.
- **Contracts**: `CoachQuestion`, `CoachAnswer`, `CoachNote`, `CoachSession` schemas and the
  `coach.start` / `coach.answer` RPCs in `packages/contracts`. Model output is decoded with
  the same schemas (`LanguageModel.generateObject`), so a malformed answer is a typed failure,
  not a broken UI.
- **Storage**: `coach_sessions { id, workout_id?, model, status, created_at }` and
  `coach_messages { session_id, seq, role, content_json }`, so a session can be resumed and
  audited.

## Privacy

Every coach session sends workout data to OpenRouter and the model provider behind it. The coach
is opt-in, the settings page says which model is used, and tool results include only what the
question needs (no free-text notes unless the session is about that workout).

## Testing

- Tools: handler tests against in-memory SQLite, like the store tests today; MCP wiring through
  `effect/ai/McpTest`.
- Loop: a scripted `LanguageModel` layer that returns fixed tool calls and questions, so limits,
  decoding failures and the note format are tested without the network.
