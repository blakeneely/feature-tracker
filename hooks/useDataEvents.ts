'use client';

import { useEffect, useRef } from 'react';

// Subscribes a callback to the server's data-change stream (GET /api/events,
// SSE): it runs whenever anything under data/ changes on disk, so hooks can
// refetch the moment a terminal agent writes a board. All subscribers share
// one EventSource; the browser reconnects it automatically if the server
// restarts.
let source: EventSource | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!source) {
    source = new EventSource('/api/events');
    source.onmessage = () => {
      for (const notify of listeners) notify();
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

export function useDataEvents(onChange: () => void): void {
  // The subscription is stable for the component's lifetime; the ref keeps it
  // pointed at the latest callback without resubscribing every render.
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => subscribe(() => callback.current()), []);
}
