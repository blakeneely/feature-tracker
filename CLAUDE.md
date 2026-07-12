# Feature Tracker

A personal multi-board Kanban app. Next.js (App Router), TypeScript. Each
**feature** is one board of tickets; the boards are UI for a local,
file-backed ticket store that **Claude Code agents in other repos also read
and write** (creating tickets and moving them as they work) — that requirement
drives the architecture.

## Hard constraints

- **Local-only.** No external services, databases, auth, or third-party APIs.
  The backend is the Next.js route handlers under `app/api/` (listed below)
  plus nothing else. The client fetches only those routes.
- **The `data/` directory is the single source of truth** — never in-memory
  only, never localStorage. Every mutation writes through to a file
  immediately via the API. Layout:
  - `data/features.json` — the feature index: `{ version: 1, features:
    [{ id, name, createdAt, updatedAt, done? }] }` in display order (new
    features are prepended; `done?: boolean`, absent = not done). Ids are
    slugs, fixed at creation; **renaming a feature changes only `name` — the
    board filename never changes.**
  - `data/boards/<id>.json` — one board file per feature, version-3 board
    shape (below). Version-1/2 files migrate automatically on first read.
  - A legacy single-board `data/tickets.json` migrates on first read: it moves
    to `data/boards/general.json` and the index gets a "General" feature.
- **The files are shared with external processes.** Terminal agents may edit
  `data/boards/<id>.json` directly or call the API. Writes must be atomic
  (write temp file, then rename) so a concurrent read never sees a
  half-written file. The UI updates live: the server watches `data/`
  (`fs.watch` in `lib/storage.ts`) and streams change events over
  `GET /api/events` (SSE); the browser refetches on each event, with a
  window-focus refetch as fallback. Last write wins — no locking; boards
  being per-file is what keeps agents on different features from clobbering
  each other.
- **Ask before adding npm dependencies.** The approved set is
  Next.js/React/TypeScript plus the agreed drag-and-drop library:
  `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Anything beyond
  that — even a small utility — gets proposed and approved first.

- **Nothing machine-specific is committed.** `data/`, `tracker.config.json`,
  and `.claude/settings.local.json` are gitignored; the app self-seeds an
  empty `data/` on first run. Machine setup is `scripts/setup.ps1` (see
  `SETUP.md`) — it writes `tracker.config.json` (`{ port }`, default 3000)
  and installs the `/to-feature` skill from the in-repo template. Anything
  new that depends on an absolute path or the port must go through that
  config/stamping flow, never be hardcoded.

## API surface (`http://localhost:<port>`, default 3000)

- `GET  /api/features` — the feature index (find a board's id by its name here)
- `POST /api/features` `{ name }` — create a feature + empty board file; the
  new feature is prepended (top of the sidebar)
- `PUT  /api/features` `{ ids }` — set display order; ids must be a permutation
  of every current feature id (409 on a stale list)
- `PATCH  /api/features/<id>` `{ name?, done? }` — rename (display name only)
  and/or mark done; at least one field required
- `DELETE /api/features/<id>` — remove the feature and delete its board file
- `GET/PUT /api/features/<id>/tickets` — one board, whole-file read/replace
- `GET  /api/events` — SSE stream; emits `data: {"files":[...]}` (debounced)
  whenever anything under `data/` changes — the changed paths relative to
  `data/`, forward slashes (e.g. `"boards/general.json"`); `[]` means
  "something changed, unknown what". Drives the UI's live refresh (refetch +
  the sidebar's unseen-changes dot); agents don't need it (they read
  files/GET on demand)
- `POST /api/shutdown` — exits the server process (the sidebar Quit button)
- `GET/PUT /api/tickets` — **gone**; returns 410 with directions (pre-multi-board
  agent prompts may still call it)

### Agents working a feature board

1. Find the board: `GET /api/features`, match `name`, take `id` — or read
   `data/features.json`.
2. Read/write `data/boards/<id>.json` directly (atomic: temp file + rename),
   or `GET`/`PUT /api/features/<id>/tickets`.
3. When adding a ticket, set `number = nextNumber` and increment `nextNumber`
   — the API rejects boards where a number repeats or reaches `nextNumber`.
4. Record where the work came from: set the board's `conversation` when you
   create the board, and a ticket's `conversation` when you add a ticket from
   a *different* conversation than the board's origin (shape below). Preserve
   any `conversation` fields already present when writing a board back.

## Ticket data shape

```ts
type ColumnId = 'new' | 'active' | 'resolved';  // union type, never a loose string

interface Ticket {
  id: string;          // crypto.randomUUID() — never Date.now() or array indexes
  number: number;      // sequential visual id (#0042) — unique per board, never reused
  title: string;
  description: string;
  tags: string[];      // unique, non-empty strings; [] = untagged
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
  conversation?: ConversationRef;  // conversation that created this ticket,
                                   // if not the board's own origin
}

// Link back to the Claude Code conversation that created a board or ticket.
// Written only by agents; the UI renders it as a chip (board: masthead
// "Origin"; ticket: dialog view mode only, never on the card) that copies
// `claude --resume <sessionId>` on click.
interface ConversationRef {
  sessionId: string;       // Claude Code session UUID
  cwd: string;             // working directory the conversation ran in
  transcriptPath: string;  // absolute path to the session's .jsonl transcript
}
```

Ticket numbers are per board, assigned by the reducer from `nextNumber` in
board state.

**Status is not stored on the ticket.** It is derived from which column holds
the ticket's id — one source of truth, so a drag can never leave a ticket's
status out of sync with its position.

## Board state & file shape

```ts
interface BoardState {
  tickets: Record<string, Ticket>;      // lookup by id
  columns: Record<ColumnId, string[]>;  // ordered ticket ids per column
  nextNumber: number;                   // next visual id to assign
  conversation?: ConversationRef;       // conversation that triggered the board
}

interface BoardFile extends BoardState {
  version: number;                      // 3 — bump on shape migration
}
```

Search/filter state (query, tag dropdown) is view state in `Board` — it is
never persisted and never enters any data file. Feature selection and the
sidebar's unseen-changes dots are view state in `Workspace`. localStorage holds view preferences only — the
sidebar's width (drag its border to resize) and the theme override
(`feature-tracker:theme`, absent = follow the system); board/ticket data
still never goes there. Theming is CSS `light-dark()` tokens in
`globals.css` driven by `color-scheme`; `data-theme` on `<html>` forces a
side (set pre-paint by an inline script in `layout.tsx`, toggled by
`ThemeToggle`).

`Workspace` owns the feature list (via `useFeatures`) and selection; `Board`
owns one board's tickets in a single `useReducer` (via `useBoardStorage`) and
remounts per feature (`key={featureId}`). State flows down as props — child
components never fetch or keep their own copies of ticket data. Reducer
updates are immutable — no in-place array/object mutation.

## File & naming conventions

- `components/` — one component per file, PascalCase filename matching the
  component: `Workspace.tsx` (shell: sidebar + active board + Quit),
  `FeatureSidebar.tsx` (feature list, inline create/rename, done toggle,
  delete, drag reorder), `FeatureItem.tsx` (one sortable sidebar row;
  unseen-changes dot, muted/struck-through when done),
  `Board.tsx`, `BoardHeader.tsx` (feature name + filters), `Column.tsx`,
  `TicketCard.tsx`, `TicketDialog.tsx` (view-first detail modal),
  `ConfirmDialog.tsx` (window.confirm replacement on the ticket-dialog glass
  surface — quit + feature delete; never window.confirm/alert),
  `TagEditor.tsx` (inline pills), `ConversationLink.tsx` (copy-resume chip
  for `ConversationRef`s), `AgentTaskLink.tsx` (the mirror chip — copies a
  self-contained reference, board id/ticket + absolute board-file path, to
  paste to a fresh agent so it goes and works that board or ticket;
  masthead "Hand off" + ticket dialog footer), `ThemeToggle.tsx`
  (sidebar-footer theme cycler: system/dark/light).
- `hooks/` — camelCase with `use` prefix: `useBoardStorage.ts` (one board:
  hydrate via GET, write through via PUT, live refetch on data events + focus
  fallback; refetches are deferred while a drag or a PUT is in flight, then
  flushed), `useFeatures.ts` (the index: hydrate, live refetch + focus
  fallback, create/rename/set-done/delete), `useDataEvents.ts` (one shared
  EventSource on `/api/events`; subscribers get a `(files: string[]) => void`
  callback per data change — the changed `data/` paths, `[]` when unknown).
- `lib/board.ts`, `lib/features.ts` — pure, framework-free domain logic
  (types, reducer, validation). No React, no Node APIs — importable anywhere,
  easily testable.
- `lib/storage.ts` — server-only file I/O for `data/`. Only the API routes
  import this; it never reaches client code.
- `scripts/` — the desktop launcher (`launch-board.vbs` → `launch-board.ps1`
  starts the dev server hidden on the configured port and opens an app-mode
  browser window; the desktop shortcut targets it), its icon, and
  `setup.ps1` (one-time machine setup: deps, `tracker.config.json`, skill
  install, shortcut).
- `skills/to-feature/SKILL.md` — the shareable `/to-feature` skill
  **template**; `{{TRACKER_ROOT}}` and `{{PORT}}` are stamped by `setup.ps1`
  when it installs the skill to `~/.claude/skills/`. Edit the template, not
  the installed copy.
- Client components only where interactivity requires it; keep `app/page.tsx` thin.
