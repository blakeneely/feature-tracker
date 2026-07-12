'use client';

import { useEffect, useRef } from 'react';

// Subscribes a callback to the server's data-change stream (GET /api/events,
// SSE): it runs whenever anything under data/ changes on disk, so hooks can
// refetch the moment a terminal agent writes a board. Each event carries the
// changed paths relative to data/ (e.g. 'boards/general.json'); an empty
// array means "something changed, unknown what" — callers should still
// refetch. All subscribers share one EventSource; the browser reconnects it
// automatically if the server restarts.
let source: EventSource | null = null;
const listeners = new Set<(files: string[]) => void>();

function parseFiles(data: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(data));
    const files = (parsed as { files?: unknown }).files;
    if (Array.isArray(files) && files.every((file): file is string => typeof file === 'string')) {
      return files;
    }
  } catch {
    // fall through — a malformed payload still means "something changed"
  }
  return [];
}

function subscribe(listener: (files: string[]) => void): () => void {
  listeners.add(listener);
  if (!source) {
    source = new EventSource('/api/events');
    source.onmessage = (event) => {
      const files = parseFiles(event.data);
      for (const notify of listeners) notify(files);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}

export function useDataEvents(onChange: (files: string[]) => void): void {
  // The subscription is stable for the component's lifetime; the ref keeps it
  // pointed at the latest callback without resubscribing every render.
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => subscribe((files) => callback.current(files)), []);
}
