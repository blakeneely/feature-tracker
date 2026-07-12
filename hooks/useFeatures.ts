'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDataEvents } from '@/hooks/useDataEvents';
import {
  isFeaturesFile,
  reorderFeatures as applyReorder,
  type Feature,
} from '@/lib/features';

interface FeaturesStorage {
  features: Feature[] | null; // null until the first load resolves
  error: string | null;
  createFeature: (name: string) => Promise<Feature | null>;
  renameFeature: (id: string, name: string) => Promise<void>;
  deleteFeature: (id: string) => Promise<void>;
  reorderFeatures: (ids: string[]) => Promise<void>;
}

async function errorFromResponse(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // fall through to the status line
  }
  return `${response.url} returned ${response.status}`;
}

// Owns the feature list and keeps it in sync with /api/features: hydrate
// after mount, refetch live on data-change events and on window focus as a
// fallback (agents can create features too), apply mutations through the API
// and mirror the response locally.
export function useFeatures(): FeaturesStorage {
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch('/api/features');
      if (!response.ok) throw new Error(await errorFromResponse(response));
      const file: unknown = await response.json();
      if (!isFeaturesFile(file)) throw new Error('Server returned an invalid feature index');
      setFeatures(file.features);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setFeatures((current) => current ?? []); // never strand the UI on the loading state
    }
  }, []);

  useEffect(() => {
    void refetch();
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  useDataEvents(refetch);

  const createFeature = useCallback(async (name: string): Promise<Feature | null> => {
    try {
      const response = await fetch('/api/features', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await errorFromResponse(response));
      const created = (await response.json()) as Feature;
      setFeatures((current) => [...(current ?? []), created]);
      setError(null);
      return created;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    }
  }, []);

  const renameFeature = useCallback(async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/features/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await errorFromResponse(response));
      const renamed = (await response.json()) as Feature;
      setFeatures((current) =>
        (current ?? []).map((feature) => (feature.id === id ? renamed : feature)),
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const deleteFeature = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/features/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await errorFromResponse(response));
      setFeatures((current) => (current ?? []).filter((feature) => feature.id !== id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  // Optimistic: the sidebar already shows the drop, so mirror it locally
  // first, then persist. If the server disagrees (stale ids — an agent
  // created or deleted a feature meanwhile), refetch to fall back to the
  // file's order rather than leave the UI lying.
  const reorderFeatures = useCallback(
    async (ids: string[]) => {
      setFeatures((current) => (current && applyReorder(current, ids)) || current);
      try {
        const response = await fetch('/api/features', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (!response.ok) throw new Error(await errorFromResponse(response));
        const file: unknown = await response.json();
        if (!isFeaturesFile(file)) throw new Error('Server returned an invalid feature index');
        setFeatures(file.features);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        void refetch();
      }
    },
    [refetch],
  );

  return { features, error, createFeature, renameFeature, deleteFeature, reorderFeatures };
}
