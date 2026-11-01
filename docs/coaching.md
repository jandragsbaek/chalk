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
  same formulas as the Strength page), `list_benchmarks` (the catalog of named workouts, with
  scoring and the posted prescription, by category or name), `list_benchmark_results` and
  `find_similar_sessions` (a session's, or a date range's, repeats and look-alikes from
  `WorkoutStore.similar()`: both sides' date, result or heaviest set, and the differences in
  the sheet's words; at most 10 sessions and 3 matches per part). Each is an Effect `Tool`
  with Schema parameters and results; a failure (unknown movement, storage) goes back to the
  model as a message instead of breaking the reply. Free-text notes are not sent.
- **Loop** (`CoachService`): the thread's transcript (the `Chat` export, tool calls and results
  included) is stored with the thread, so a reply resumes with everything read before. Per
  reply: at most 8 reads (past that a read answers "budget spent"), 5 model calls (the last may
  not call tools) and 120 s. A reply that hits a limit or a model error is still saved, marked
  `stopped`, so the thread stays whole. A model call that ends with no text and no reads (Claude
  sometimes does this right after a tool result) gets one follow-up user message asking for the
  answer, instead of saving an empty reply.
- **Transport**: `coach.send` is a streamed RPC: the saved athlete turn, each read as it starts
  and finishes, then the saved reply. The RPC endpoint speaks newline-delimited JSON so the
  stream reaches the browser as it happens. `coach.status`, `coach.threads` and `coach.thread`
  are plain RPCs.
- **Storage** (migrations 9 and 11): `coach_threads { id, title, model, history, ... }` (the
  thread's `model` is the one that last answered) and
  `coach_turns { thread_id, seq, role, text, receipts, model, stopped, created_at }` (`model` on
  coach turns only; null on replies saved before models could be picked).
- **Config**: `OPENROUTER_API_KEY` (server only, read with `Config.Redacted`) and
  `CHALK_COACH_MODEL`, the default model (default `anthropic/claude-sonnet-5.5`). Without a key
  `coach.send` fails with `CoachUnavailableError` and the page says what to set; saved threads
  stay readable.
- **Models**: see [Models](#models) below.
- **Tests**: a scripted `LanguageModel` drives the loop without the network (receipts and their
  numbering, resuming, the read budget, model failures, picking and refusing models), and
  `layerModel` is checked against config (a default on the list, one outside it, no key).

## Models

The composer's privacy line, "Your log goes to [model] through OpenRouter", is also the model
pick. It applies to the next message; a thread opens on the model that last answered it (while
still offered), a new one on the default. Each coach turn prints the model that wrote it next to
its read count, and the thread's Model box shows the last one.

- **The list** is `COACH_MODELS` in `packages/contracts/src/coach.ts`: slug, label and a price
  hint. `coach.status` returns the default and what may be picked; `coach.send` takes an
  optional `model`.
- **Allowlist**: the server answers only with a listed slug (or the default) and refuses
  anything else from the browser with `CoachModelNotAllowedError { model }`, before saving
  anything.
- **`CHALK_COACH_MODEL` outside the list**: the server trusts its own config. That slug becomes
  the default and is offered first, unpriced ("Set on the server"), ahead of the list; startup
  logs a warning. Failing startup would take the coach down over a typo in a model name the
  operator chose; silently swapping in a listed model would answer with one they did not ask
  for.
- **Why these** (OpenRouter, November 2026; price per million tokens in / out; tool-call
  accuracy from OpenRouter's live τ²-Bench airline board, which scores multi-step tool use only):

  | Model               | Slug                           | Price         | τ²    | Why                                                                                                         |
  | ------------------- | ------------------------------ | ------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
  | Claude Sonnet 5.5   | `anthropic/claude-sonnet-5.5`  | $2 / $10      | 78.8% | The default: best tool use on the list and the fastest per task; the reference the rest are judged against. |
  | Claude Haiku 5.5    | `anthropic/claude-haiku-5.5`   | $0.10 / $0.50 | 72.8% | Anthropic at a twentieth of the price, for quick lookups ("what was my last 5RM?").                         |
  | GPT-6.1 Terra       | `openai/gpt-6.1-terra`         | $1 / $5       | 68.7% | OpenAI's mid tier, built for everyday agentic work; a second opinion from another lab.                      |
  | Gemini 3.8 Flash    | `google/gemini-3.8-flash`      | $0.83 / $4.13 | 71.3% | Google's strongest Flash; calls tools iteratively, so it tends to read more before answering.               |
  | GLM 5.3             | `z-ai/glm-5.3`                 | $0.08 / $3.60 | 77.3% | Open weights and within two points of Sonnet on tool use, at a fraction of the input price.                 |
  | DeepSeek V4.1 Flash | `deepseek/deepseek-v4.1-flash` | $0.05 / $0.50 | 75.1% | Open weights, the cheapest on the list, and still ahead of every closed small model here.                   |

  Left out: flagships (Opus 5.5, GPT-6.1 Sol, Gemini 4 Argon at $2-4 in / $10-20 out) cost
  more than a log lookup needs; GPT-6 Luna and MiniMax M3.1 Flash are cheaper but scored lowest
  on tool use. Every model listed supports `tools` and `tool_choice` on OpenRouter; the coach
  needs `tool_choice: none` for its last step.

- **Changing the list**: edit `COACH_MODELS`; check the slug and its `supported_parameters`
  (`tools`, `tool_choice`) on `https://openrouter.ai/api/v1/models`. A thread whose model left
  the list keeps it in its history and switches to the default on its next message.

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
is opt-in (no key, no coach), the composer names (and picks) the model your log goes to, and tool results include only what the
question needs (no free-text notes unless the session is about that workout).

## Testing

- Tools: handler tests against in-memory SQLite, like the store tests today; MCP wiring through
  `effect/ai/McpTest`.
- Loop: a scripted `LanguageModel` layer that returns fixed tool calls and questions, so limits,
  decoding failures and the note format are tested without the network.
