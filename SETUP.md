# Setting up Feature Tracker on your machine

Everything machine-specific (your board data, your port, your paths) lives
outside git, so setup is: clone, run one script, done. Nothing in the repo
needs editing.

## What you need

- **Windows** (the launcher and desktop shortcut are Windows-only; on
  mac/Linux you can still `npm install && npm run dev` and use the app in a
  browser — skip the setup script)
- **Node.js 18.18 or newer** — <https://nodejs.org>
- **Claude Code** (optional, but it's the point of the app — agents create
  and move tickets on your boards)

## The easy way: let Claude set it up

Open Claude Code in the cloned repo and paste this:

```
I just cloned the Feature Tracker repo and you're running inside it. Set it
up for this machine:

1. Read SETUP.md so you know what the setup script does.
2. Check whether port 3000 is free; pick a free port if it isn't.
3. Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
   (add -Port <n> if you picked a different port).
4. Verify the install: confirm tracker.config.json exists, confirm
   ~\.claude\skills\to-feature\SKILL.md exists and contains this repo's
   absolute path and the chosen port — no {{PLACEHOLDER}} text left.
5. Start the app (npm run dev -- -p <port>), confirm
   http://localhost:<port>/api/features responds, then stop the server.
6. Tell me the port you chose, where the skill was installed, and that the
   desktop shortcut is ready.
```

Claude fills in every machine-specific value itself — there is nothing for
you to look up or edit.

## The manual way

From the repo root:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
```

Add `-Port 3100` (any free port) if something else on your machine already
uses 3000. Add `-NoShortcut` to skip the desktop shortcut. The script is
idempotent — rerun it whenever you move the repo or want a different port.

It does four things:

1. `npm install` (only if `node_modules` is missing)
2. Writes `tracker.config.json` — the one file of machine-specific
   variables. Currently just `{ "port": <n> }`; it's gitignored, and the
   launcher reads it.
3. Installs the **`/to-feature` Claude Code skill** to
   `%USERPROFILE%\.claude\skills\to-feature\`, stamping the template in
   `skills/to-feature/SKILL.md` with this repo's absolute path and your
   port. This is what lets agents in your *other* repos find your board.
4. Creates a **Feature Tracker** desktop shortcut (silent server start +
   app-mode browser window).

Then launch from the shortcut, or run `npm run dev -- -p <port>` and open
`http://localhost:<port>`.

## Where your stuff lives (and why it never gets committed)

| Thing | Where | Git status |
| --- | --- | --- |
| Your boards and tickets | `data/` (self-creates on first run) | ignored |
| Your port | `tracker.config.json` | ignored |
| Your Claude Code permissions | `.claude/settings.local.json` | ignored |
| Your `/to-feature` skill | `%USERPROFILE%\.claude\skills\` | outside the repo |

Board files can contain `conversation` links with absolute paths to your
Claude transcripts — that's expected and fine precisely because `data/` never
leaves your machine.

## If you move the repo or change the port

Rerun the setup script. The installed skill and the shortcut have your old
absolute path/port stamped in; the script re-stamps both.
