# Feature Tracker

A personal, local-only Kanban app where the boards are shared with Claude
Code agents. Each **feature** is one board of tickets (New / Active /
Resolved). You work the boards in a browser; agents running in other repos
create tickets and move them as they work, by editing the same JSON files or
calling the same API. No cloud, no database, no accounts — everything lives
in this folder.

## First-time setup

New machine? See [`SETUP.md`](SETUP.md) — one script (`npm run setup`)
installs dependencies, picks up your port, installs the `/to-feature` Claude
Code skill with your paths stamped in, and creates the desktop shortcut. It
also has a prompt you can paste into Claude Code to have it do the whole
thing for you. All machine-specific state (`data/`, `tracker.config.json`,
`.claude/settings.local.json`) is gitignored, so nothing personal ever gets
committed.

## Running it

**Desktop shortcut (the normal way).** The shortcut targets
`scripts/launch-board.vbs`, which runs `launch-board.ps1` silently: it starts
the dev server if it isn't already running (on the port in
`tracker.config.json`, default 3000), waits for it to respond, then opens the
board in an app-mode window (Chrome if installed, else Edge; falls back to a
normal tab). Launching twice won't start a second server.

**From a terminal:**

```
npm install            # first time only
npm run dev -- -p 3000 # use your tracker.config.json port; then open http://localhost:<port>
```

**Quitting.** Closing the browser window does *not* stop the server — it
keeps running hidden. Use the **Quit** button at the bottom of the sidebar,
which shuts the server process down (via `POST /api/shutdown`).

## Using the board

- **Features** live in the left sidebar: create, rename, delete, and
  drag to reorder. The magnifier icon filters the list by name. Selecting a
  feature opens its board.
- **Tickets** are cards in three columns. Drag to move (dragging between
  columns is what changes a ticket's status — status isn't stored anywhere
  else), click a title to open the full view, edit from there.
- **Search and tag filters** sit in the board header. They're view-only and
  reset when you switch boards.
- **Theme** cycles Auto → Dark → Light from the sidebar footer. Auto follows
  the system.
- The UI refetches whenever the window regains focus, so ticket changes made
  by agents show up without a manual refresh.

## Where the data lives

`data/` is the single source of truth, as plain JSON you can read, diff, or
back up:

- `data/features.json` — the feature index, in sidebar display order.
- `data/boards/<id>.json` — one file per feature: its tickets, column
  order, and next ticket number.

Every edit in the UI writes through to disk immediately. There is no other
persistence — localStorage holds only view preferences (sidebar width,
theme override).

## How agents fit in

This app exists so Claude Code agents can share your ticket boards:

- The `/to-feature` skill turns a conversation into a feature board, seeds it
  with tickets, and stamps the board with a `conversation` link back to the
  session that created it.
- The board header shows that link as an **Origin** chip; ticket-level chips
  appear in the ticket dialog. Clicking one copies a
  `claude --resume <session-id>` command so you (or an agent) can reopen the
  originating conversation.
- Agents in other repos find a board via `GET /api/features`, then read/write
  `data/boards/<id>.json` directly (atomically) or use
  `GET`/`PUT /api/features/<id>/tickets`. Because each feature is its own
  file, agents working different features never clobber each other.

The full API surface, data shapes, and the rules agents must follow are
documented in [`CLAUDE.md`](CLAUDE.md) — that file is the contract; this one
is the tour.

## Stack

Next.js (App Router) + React + TypeScript, with `@dnd-kit` for drag-and-drop.
Domain logic is framework-free in `lib/`, file I/O is server-only in
`lib/storage.ts`, and the UI is plain CSS (`app/globals.css`) with
`light-dark()` design tokens.
