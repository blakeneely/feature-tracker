'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  boardReducer,
  DATA_VERSION,
  initialState,
  isBoardFile,
  type BoardAction,
  type BoardState,
} from '@/lib/board';

interface BoardStorage {
  state: BoardState;
  dispatch: React.Dispatch<BoardAction>;
  hydrated: boolean;
  error: string | null;
}

// Owns one feature board's client state and keeps it in sync with GET/PUT
// /api/features/<id>/tickets: hydrate after mount, write through on every
// state change, refetch on window focus to pick up edits made by terminal
// agents. Board remounts per feature (key={featureId}), so each board gets a
// fresh instance of this state.
export function useBoardStorage(featureId: string): BoardStorage {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A state change caused by hydrating from the server must not be written
  // straight back — the server already has it.
  const skipNextWrite = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(`/api/features/${featureId}/tickets`);
      if (!response.ok) throw new Error(`GET /api/features/${featureId}/tickets returned ${response.status}`);
      const file: unknown = await response.json();
      if (!isBoardFile(file)) throw new Error('Server returned an invalid board file');
      const { version: _version, ...boardState } = file;
      skipNextWrite.current = true;
      dispatch({ type: 'hydrate', state: boardState });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setHydrated(true);
    }
  }, [featureId]);

  useEffect(() => {
    void refetch();
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    // Whole-board replace: a newer write supersedes an in-flight one, so
    // aborting the stale request is safe.
    const controller = new AbortController();
    fetch(`/api/features/${featureId}/tickets`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: DATA_VERSION, ...state }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`PUT /api/features/${featureId}/tickets returned ${response.status}`);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => controller.abort();
  }, [state, hydrated, featureId]);

  return { state, dispatch, hydrated, error };
}
