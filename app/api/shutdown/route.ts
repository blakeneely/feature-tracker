// POST /api/shutdown — stops the local server. Used by the board's Quit
// button so the hidden server process (started by the desktop launcher) can
// be shut down without hunting for it in Task Manager.
export async function POST() {
  // Delay the exit so the response flushes before the process dies. In dev,
  // the `next dev` supervisor exits along with its server child on a
  // non-restart exit code, so this stops the whole process tree.
  setTimeout(() => process.exit(0), 250);
  return Response.json({ ok: true });
}
