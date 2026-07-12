'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import FeatureItem from '@/components/FeatureItem';
import ThemeToggle from '@/components/ThemeToggle';
import type { Feature } from '@/lib/features';

interface FeatureSidebarProps {
  features: Feature[];
  loaded: boolean; // false until the first fetch resolves
  selectedId: string | null;
  unseenIds: ReadonlySet<string>; // boards changed while not selected (view state)
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onSetDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void; // full id list in new display order
  onQuit: () => void;
}

export default function FeatureSidebar({
  features,
  loaded,
  selectedId,
  unseenIds,
  onSelect,
  onCreate,
  onRename,
  onSetDone,
  onDelete,
  onReorder,
  onQuit,
}: FeatureSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const visibleFeatures = query
    ? features.filter((feature) => feature.name.toLowerCase().includes(query))
    : features;

  const sensors = useSensors(
    // 5px activation distance, as on the board: clicks on a row's controls
    // register as clicks instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const submitCreate = () => {
    const name = draft.trim();
    if (name) onCreate(name);
    setDraft('');
    setCreating(false);
  };

  const submitRename = (id: string) => {
    const name = editDraft.trim();
    const current = features.find((feature) => feature.id === id);
    if (name && current && name !== current.name) onRename(id, name);
    setEditingId(null);
  };

  const confirmDelete = (feature: Feature) => {
    const message = `Delete "${feature.name}" and every ticket on its board?\n\nThis cannot be undone.`;
    if (window.confirm(message)) onDelete(feature.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = features.map((feature) => feature.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <aside className="sidebar" aria-label="Features">
      <div className="sidebar-title">
        <h1>Feature Tracker</h1>
        <span className="masthead-badge">local · file-backed</span>
      </div>

      <div className="sidebar-section">
        <span className="control-label">Features</span>
        <div className="sidebar-section-actions">
          <button
            type="button"
            className={searching ? 'sidebar-search-toggle active' : 'sidebar-search-toggle'}
            title="Filter features"
            aria-label="Filter features"
            // Keep focus on the input so its blur handler doesn't close the
            // search first and make this click reopen it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (searching) {
                setSearch('');
                setSearching(false);
              } else {
                setSearching(true);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            className="sidebar-new"
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
          >
            New feature
          </button>
        </div>
      </div>

      {searching && (
        <input
          className="feature-input"
          autoFocus
          value={search}
          placeholder="Filter features"
          onChange={(event) => setSearch(event.target.value)}
          onBlur={() => {
            if (!search.trim()) setSearching(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSearch('');
              setSearching(false);
            }
          }}
        />
      )}

      {creating && (
        <input
          className="feature-input"
          autoFocus
          value={draft}
          placeholder="Feature name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={submitCreate}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitCreate();
            if (event.key === 'Escape') {
              setDraft('');
              setCreating(false);
            }
          }}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visibleFeatures.map((feature) => feature.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="feature-list">
            {visibleFeatures.map((feature) =>
              editingId === feature.id ? (
                <li key={feature.id}>
                  <input
                    className="feature-input"
                    autoFocus
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    onBlur={() => submitRename(feature.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitRename(feature.id);
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  selected={feature.id === selectedId}
                  unseen={unseenIds.has(feature.id)}
                  onSelect={() => onSelect(feature.id)}
                  onStartRename={() => {
                    setCreating(false);
                    setEditDraft(feature.name);
                    setEditingId(feature.id);
                  }}
                  onToggleDone={() => onSetDone(feature.id, !feature.done)}
                  onDelete={() => confirmDelete(feature)}
                />
              ),
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {loaded && features.length === 0 && !creating && (
        <p className="sidebar-empty">No features yet. Create one to open its board.</p>
      )}
      {loaded && features.length > 0 && visibleFeatures.length === 0 && (
        <p className="sidebar-empty">No features match &ldquo;{search.trim()}&rdquo;.</p>
      )}
      {!loaded && <p className="sidebar-empty">Loading features…</p>}

      <div className="sidebar-footer">
        <ThemeToggle />
        <button type="button" className="quit-button" title="Stop the board server" onClick={onQuit}>
          Quit
        </button>
      </div>
    </aside>
  );
}
