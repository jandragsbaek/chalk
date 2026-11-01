# Coach

Two ways to talk to the coach, on the Coach page (`/coach`):

- **Conversations (built).** Ask anything about your training. The coach reads the log with
  read-only tools before it answers, and every read is kept as a numbered **receipt** (R1, R2,
  ... across the thread): what it asked for, a one-line answer, and the rows it saw. The reply
  cites them, "(R2)", and the page opens a receipt when you follow the citation.
- **Check-ins (next).** A conversation tied to one workout, for sessions without a debrief:
  the coach reads the session and asks up to four questions as structured boxes (session RPE,
  limiters, feel, one question of its own), and the answers fill the workout's existing
  `Debrief`, the same one the Import page shows. Then a short note.

## Conversations (built)

- **Tools** (`apps/server/src/coach/tools.ts`): `list_movements`, `list_workouts`,
  `list_lift_sets`, `get_rep_maxes` (with the best estimated 1RM, Epley with its spread, the
  same formulas as the Strength page) and `list_benchmark_results`. Each is an Effect `Tool`
  with Schema parameters and results; a failure (unknown movement, storage) goes back to the
  model as a message instead of breaking the reply. Free-text notes are not sent.
- **Loop** (`CoachService`): the thread's transcript (the `Chat` export, tool calls and results
  included) is stored with the thread, so a reply resumes with everything read before. Per
  reply: at most 8 reads (past that a read answers "budget spent"), 5 model calls (the last may
  not call tools) and 120 s. A reply that hits a limit or a model error is still saved, marked
  `stopped`, so the thread stays whole.
- **Transport**: `coach.send` is a streamed RPC: the saved athlete turn, each read as it starts
  and finishes, then the saved reply. The RPC endpoint speaks newline-delimited JSON so the
  stream reaches the browser as it happens. `coach.status`, `coach.threads` and `coach.thread`
  are plain RPCs.
- **Storage** (migration 9): `coach_threads { id, title, model, history, ... }` and
  `coach_turns { thread_id, seq, role, text, receipts, stopped, created_at }`.
- **Config**: `OPENROUTER_API_KEY` (server only, read with `Config.Redacted`) and
  `CHALK_COACH_MODEL` (default `anthropic/claude-sonnet-5.5`). Without a key `coach.send`
  fails with `CoachUnavailableError` and the page says what to set; saved threads stay
  readable.
- **Tests**: a scripted `LanguageModel` drives the loop without the network (receipts and their
  numbering, resuming, the read budget, model failures).

## Check-ins (planned)

1. **Trigger**: after logging a workout, or on demand from a workout or movement page.
2. **Gather**: the coach calls read tools: the workout just logged, recent sessions, rep maxes,
   weekly volume, scaling history for the movements involved.
3. **Ask**: at most four questions, returned as structured data, not prose:
   `CoachQuestion { id, text, kind: "scale" | "choice" | "text", options? }`.
   Examples: "Pull-ups were banded again; did the purple band feel too easy?", "That 5RM
   matched last month's. Sleep, or did the bar slow down at rep 4?", "RPE for the squats?"
4. **Answer**: the athlete answers in the UI (sliders and chips first, text optional).
5. **Note**: one final model turn produces
   `CoachNote { summary, suggestions[], flags[] }`, saved with the workout. Flags are for pain
   or injury mentions; the coach suggests seeing a professional and gives no medical advice.

Hard limits per session: tool calls (about 8), model turns (3), output tokens, and a wall-clock
timeout. A session that hits a limit ends with whatever note it has.

## MCP server (planned)

The same toolkit, exposed through `effect/ai/McpServer` (stdio in `apps/server` or an
`apps/mcp` package, same Layer graph, different transport), so Claude Code, Claude Desktop or
any MCP client can read Chalk too. Later tools: `movement_volume` (after the volume grid),
`scaling_history` (after scaling), and narrowly, `save_coach_note { workoutId, note }`.

## Privacy

Every coach session sends workout data to OpenRouter and the model provider behind it. The coach
is opt-in (no key, no coach), the composer names the model your log goes to, and tool results include only what the
question needs (no free-text notes unless the session is about that workout).

## Testing

- Tools: handler tests against in-memory SQLite, like the store tests today; MCP wiring through
  `effect/ai/McpTest`.
- Loop: a scripted `LanguageModel` layer that returns fixed tool calls and questions, so limits,
  decoding failures and the note format are tested without the network.
