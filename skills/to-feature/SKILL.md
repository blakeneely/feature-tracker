---
name: to-feature
description: Create a new feature board in the Feature Tracker for the current work, link it back to this conversation via the board's conversation field, and seed it with tickets. Use when the user says "make this a feature", "put this on the board", "track this", or invokes /to-feature.
allowed-tools: Bash(curl:*), Read, Write
---

<!--
  This is a TEMPLATE. scripts/setup.ps1 stamps the {{TRACKER_ROOT}} and
  {{PORT}} placeholders with this machine's values and installs the result to
  ~/.claude/skills/to-feature/SKILL.md. Don't edit the installed copy — edit
  this file and rerun setup.
-->

# to-feature

Turn the current conversation's work into a feature on the Feature Tracker
board (`{{TRACKER_ROOT}}`, API at `http://localhost:{{PORT}}`), linked back
to THIS conversation so any future agent — on any repo — can recover the
context.

## How conversation linking works

Boards and tickets both support an optional `conversation` field:

```json
"conversation": {
  "sessionId": "<uuid>",
  "cwd": "<absolute path the conversation ran in>",
  "transcriptPath": "<user home>\\.claude\\projects\\<project-slug>\\<session-id>.jsonl"
}
```

All three values must be non-empty strings or the API rejects the write. The
UI renders the board's `conversation` as an "Origin" chip in the board header
and a ticket's `conversation` inside the ticket dialog; clicking either
copies `claude --resume <sessionId>`.

Rules:

- **Board `conversation`** = the conversation that triggered the board's
  creation. Set it when you create the board; never overwrite an existing one.
- **Ticket `conversation`** = set on tickets you create from a DIFFERENT
  conversation than the board's origin. Tickets created in the same
  conversation that created the board don't need one.
- Always preserve `conversation` fields already in the file when writing a
  board back (read-modify-write the whole board).

## Steps

### 1. Name the feature

Derive a short, human-readable feature name from what the conversation is
actually about (e.g. "Benchmarking export CSV", not "Misc work"). If the user
supplied a name as the skill argument, use that verbatim.

### 2. Identify this conversation

Both values come from your scratchpad directory path, which looks like:

```
<...>\Temp\claude\<project-slug>\<session-id>\scratchpad
```

- `sessionId` — the UUID segment.
- `cwd` — your working directory.
- `transcriptPath` —
  `<user home>\.claude\projects\<project-slug>\<session-id>.jsonl`
  (the `<project-slug>` is the same one in the scratchpad path; `<user home>`
  is the current user's home directory — `%USERPROFILE%` on Windows).

If you cannot find a scratchpad path in your context, say so and ask the user
for the session id rather than guessing.

### 3. Create the feature

Prefer the API:

```
curl -s -X POST http://localhost:{{PORT}}/api/features \
  -H "Content-Type: application/json" -d '{"name":"<feature name>"}'
```

The response includes the feature `id` (a slug). Then GET
`/api/features/<id>/tickets`, set the top-level `conversation` field, and PUT
the whole board back.

If the server is not running (connection refused), edit the files directly in
`{{TRACKER_ROOT}}\data\`:

1. Slugify the name (lowercase, spaces→`-`, strip non-alphanumerics); ensure
   it's unique in `features.json`.
2. Append `{ id, name, createdAt, updatedAt }` (epoch ms) to the `features`
   array in `data/features.json`.
3. Create `data/boards/<id>.json` with
   `{ "version": 3, "tickets": {}, "columns": { "new": [], "active": [], "resolved": [] }, "nextNumber": 1, "conversation": { ... } }`.
4. All file writes must be atomic: write to a temp file in the same
   directory, then rename over the target.

### 4. Seed work tickets

Create a ticket per concrete piece of work discussed in the conversation:

- `id`: a fresh UUID (never a timestamp or index)
- `number`: the board's current `nextNumber`, then increment `nextNumber` —
  the API rejects repeated numbers or numbers ≥ `nextNumber`
- `createdAt` / `updatedAt`: current epoch ms
- `tags`: unique non-empty strings, `[]` if none
- Status is NOT a ticket field — put the ticket's id in the `new` column
  (or `active` if the work is already underway)
- No `conversation` on these tickets — the board's origin covers them

Write by PUTting the whole board or an atomic file write. Keep titles
imperative and short; put detail in `description`. Don't invent work that
wasn't discussed — a feature with 2 real tickets beats one with 8
speculative ones.

#### Writing the `description`

Write for a human scanning the board, not for another agent. The UI shows
the first line as the card's one-line preview and renders the full text
with line breaks preserved (plain text, no markdown):

- First line: one plain-English sentence saying what and why. It must
  stand alone — it is all the card shows.
- Blank line, then the details as short `- ` bullets: one action, file
  path, or decision per bullet — never a wall-of-text paragraph.
- End with references (session ids, docs, scratchpad files) on their own
  lines, each prefixed `Ref:`.
- Write for someone who wasn't in the conversation: expand shorthand and
  call things by their real names.

### Adding tickets to an EXISTING board later

If the user invokes this skill (or asks for tickets) and a matching feature
already exists, don't create a new one — add tickets to the existing board
and set each new ticket's `conversation` to the CURRENT conversation (step 2
values), since it differs from the board's origin. Leave the board's own
`conversation` untouched.

### 5. Report back

Tell the user: the feature name and id, how many tickets were created, and
that the board's Origin chip links back to this conversation (include the
session id).

## Agents starting work on a feature

Before working a board's tickets, read the transcript at the board's
`conversation.transcriptPath` (and any ticket-level ones) for full context on
decisions already made.
