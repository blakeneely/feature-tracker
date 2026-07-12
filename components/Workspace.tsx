'use client';

import { useEffect, useState } from 'react';
import Board from '@/components/Board';
import FeatureSidebar from '@/components/FeatureSidebar';
import { useDataEvents } from '@/hooks/useDataEvents';
import { useFeatures } from '@/hooks/useFeatures';

// Sidebar width is a view preference, not board data — it never enters the
// data/ directory. localStorage is fine for it (the CLAUDE.md ban on
// localStorage is about ticket state agents must be able to reach).
const SIDEBAR_WIDTH_KEY = 'featureTracker.sidebarWidth';
const SIDEBAR_WIDTH_DEFAULT = 240; // px — matches the old fixed 15rem
const SIDEBAR_WIDTH_MIN = 176;
const SIDEBAR_WIDTH_MAX = 480;

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width));
}

interface WorkspaceProps {
  boardsDir: string; // absolute path to data/boards on this machine
  pathSep: string; // this machine's path separator (path.sep)
}

// The app shell: feature sidebar on the left, the selected feature's board in
// the main panel. Owns feature selection, the sidebar's width, and the server
// Quit flow; each board owns its own tickets (Board remounts per feature via
// key).
export default function Workspace({ boardsDir, pathSep }: WorkspaceProps) {
  const {
    features,
    error,
    createFeature,
    renameFeature,
    setFeatureDone,
    deleteFeature,
    reorderFeatures,
  } = useFeatures();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Boards whose file changed while another feature was selected — view state
  // for the sidebar's "unseen changes" dot, never persisted anywhere.
  const [unseenIds, setUnseenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [stopped, setStopped] = useState(false); // true once /api/shutdown was sent
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [resizing, setResizing] = useState(false);

  // Restore after mount (not in the initializer) so server and client render
  // the same first frame; the saved width applies one paint later.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) setSidebarWidth(clampSidebarWidth(stored));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  // Selection is resilient by derivation: an id that disappears (deleted
  // here, or by an agent and picked up on refocus) falls back to the first
  // feature rather than stranding the board.
  const selected = features?.find((feature) => feature.id === selectedId) ?? features?.[0];
  const selectedFeatureId = selected?.id ?? null;

  // Mark boards that changed while not selected. An empty files array means
  // "something changed, unknown what" — don't guess, mark nothing.
  useDataEvents((files) => {
    const changed = files
      .map((file) => /^boards\/([a-z0-9-]+)\.json$/.exec(file)?.[1])
      .filter((id): id is string => id !== undefined && id !== selectedFeatureId);
    if (changed.length === 0) return;
    setUnseenIds((current) => {
      const next = new Set(current);
      for (const id of changed) next.add(id);
      return next;
    });
  });

  // Selecting a feature (by click or by fallback derivation) clears its dot.
  useEffect(() => {
    if (!selectedFeatureId) return;
    setUnseenIds((current) => {
      if (!current.has(selectedFeatureId)) return current;
      const next = new Set(current);
      next.delete(selectedFeatureId);
      return next;
    });
  }, [selectedFeatureId, unseenIds]);

  const handleQuit = async () => {
    const message =
      'Stop the board server?\n\nAgents will not be able to reach the API until you start it again from the desktop icon.';
    if (!window.confirm(message)) return;
    try {
      await fetch('/api/shutdown', { method: 'POST' });
    } catch {
      // The server can die before the response flushes — that still counts.
    }
    setStopped(true);
    // App-mode windows with a single history entry may close themselves;
    // if the browser refuses, the stopped screen below stays up instead.
    setTimeout(() => window.close(), 1500);
  };

  if (stopped) {
    return (
      <main className="board-status board-stopped">
        <h1>Server stopped</h1>
        <p>The board server is no longer running. You can close this window.</p>
        <p>Double-click the Feature Tracker desktop icon to start it again.</p>
      </main>
    );
  }

  const handleCreate = async (name: string) => {
    const created = await createFeature(name);
    if (created) setSelectedId(created.id);
  };

  return (
    <div
      className="workspace"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <FeatureSidebar
        features={features ?? []}
        loaded={features !== null}
        selectedId={selected?.id ?? null}
        unseenIds={unseenIds}
        onSelect={setSelectedId}
        onCreate={(name) => void handleCreate(name)}
        onRename={(id, name) => void renameFeature(id, name)}
        onSetDone={(id, done) => void setFeatureDone(id, done)}
        onDelete={(id) => void deleteFeature(id)}
        onReorder={(ids) => void reorderFeatures(ids)}
        onQuit={() => void handleQuit()}
      />
      {/* Straddles the sidebar's border: drag to resize, double-click to
          reset, arrow keys when focused. Pointer capture keeps the drag
          alive when the cursor outruns the 9px strip. */}
      <div
        className={resizing ? 'sidebar-resizer resizing' : 'sidebar-resizer'}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={sidebarWidth}
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (resizing) setSidebarWidth(clampSidebarWidth(event.clientX));
        }}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
        onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH_DEFAULT)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft')
            setSidebarWidth((width) => clampSidebarWidth(width - 16));
          if (event.key === 'ArrowRight')
            setSidebarWidth((width) => clampSidebarWidth(width + 16));
        }}
      />
      <div className="workspace-main">
        {error && (
          <p className="board-error" role="alert">
            The feature list is out of sync: {error}. Recent changes may not be saved.
          </p>
        )}
        {selected ? (
          <Board
            key={selected.id}
            featureId={selected.id}
            featureName={selected.name}
            boardFilePath={`${boardsDir}${pathSep}${selected.id}.json`}
          />
        ) : features === null ? (
          <main className="board-status">Loading features…</main>
        ) : (
          <main className="board-status board-welcome">
            <h2>No feature boards yet</h2>
            <p>
              Create a feature in the sidebar — each one gets its own board of tickets for agents
              to work from.
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
