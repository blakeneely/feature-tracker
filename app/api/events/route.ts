import { watchDataDir } from '@/lib/storage';

// Server-Sent Events: one `data: {"files":[...]}` message whenever anything
// under data/ changes, so the browser refetches the instant a terminal agent
// (or another window) writes a board — no focus change or polling needed.
// `files` lists the changed paths relative to data/ (forward slashes, e.g.
// "boards/general.json"), deduped across the debounce window; it is empty
// when the watcher couldn't tell which file changed. The stream stays open
// until the client disconnects; EventSource reconnects on its own if the
// server restarts.

export const dynamic = 'force-dynamic';

const DEBOUNCE_MS = 100; // a burst of writes (index + board file) => one message
const HEARTBEAT_MS = 30_000; // comment frames keep idle connections alive

export function GET(request: Request): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (frame: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          closed = true; // client went away mid-enqueue
        }
      };

      let debounce: ReturnType<typeof setTimeout> | undefined;
      const pendingFiles = new Set<string>();
      const unwatch = watchDataDir((filename) => {
        if (filename !== null) pendingFiles.add(filename.replace(/\\/g, '/'));
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const files = [...pendingFiles];
          pendingFiles.clear();
          send(`data: ${JSON.stringify({ files })}\n\n`);
        }, DEBOUNCE_MS);
      });
      const heartbeat = setInterval(() => send(': keep-alive\n\n'), HEARTBEAT_MS);
      send(': connected\n\n');

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimeout(debounce);
        clearInterval(heartbeat);
        unwatch();
        try {
          controller.close();
        } catch {
          // stream already errored/closed by the disconnect itself
        }
      };
      request.signal.addEventListener('abort', () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
    },
  });
}
