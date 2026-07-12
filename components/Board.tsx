'use client';

import { useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import BoardHeader from '@/components/BoardHeader';
import Column from '@/components/Column';
import TicketDialog from '@/components/TicketDialog';
import { useBoardStorage } from '@/hooks/useBoardStorage';
import {
  COLUMN_IDS,
  distinctTags,
  ticketMatches,
  type BoardState,
  type ColumnId,
  type Ticket,
} from '@/lib/board';

type DialogState =
  | { mode: 'create' }
  | { mode: 'view'; ticketId: string }
  | { mode: 'edit'; ticketId: string }
  | null;

interface BoardProps {
  featureId: string; // which board file backs this instance
  featureName: string; // masthead title
  boardFilePath: string; // absolute path to this board's file, for agent-link refs
}

// A drag target is either a column id or a ticket id — resolve to the column.
function findColumn(state: BoardState, id: string): ColumnId | undefined {
  if ((COLUMN_IDS as string[]).includes(id)) return id as ColumnId;
  return COLUMN_IDS.find((columnId) => state.columns[columnId].includes(id));
}

export default function Board({ featureId, featureName, boardFilePath }: BoardProps) {
  const { state, dispatch, hydrated, error, setDragging } = useBoardStorage(featureId);
  const [dialog, setDialog] = useState<DialogState>(null);
  // Filters are view state only — never persisted, never in the board file.
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState(''); // '' = all tags
  // After a drag, the browser still fires a click on the dropped card; this
  // ref swallows exactly that click so a drop never pops the view dialog.
  const justDragged = useRef(false);

  const sensors = useSensors(
    // The 5px activation distance is what lets clicks on a card's controls
    // register as clicks instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tags = distinctTags(state.tickets);

  const matches = (ticket: Ticket) =>
    (tagFilter === '' || ticket.tags.includes(tagFilter)) && ticketMatches(ticket, query);

  // Visible tickets per column. Drag handlers still index into the FULL
  // column arrays by id, so moves stay correct while filters are active.
  const visible: Record<ColumnId, Ticket[]> = {
    new: state.columns.new.map((id) => state.tickets[id]).filter(matches),
    active: state.columns.active.map((id) => state.tickets[id]).filter(matches),
    resolved: state.columns.resolved.map((id) => state.tickets[id]).filter(matches),
  };
  const totalTickets = Object.keys(state.tickets).length;
  const shownTickets = visible.new.length + visible.active.length + visible.resolved.length;
  const filtering = query.trim() !== '' || tagFilter !== '';

  // If the dialog's ticket disappears (deleted, or removed by an agent and
  // picked up on refocus), this is undefined and the dialog unmounts.
  const dialogTicket =
    dialog && dialog.mode !== 'create' ? state.tickets[dialog.ticketId] : undefined;
  const dialogStatus = dialogTicket ? findColumn(state, dialogTicket.id) : undefined;

  const openTicket = (id: string) => {
    if (justDragged.current) return;
    setDialog({ mode: 'view', ticketId: id });
  };

  // Status from the dialog becomes a 'move' dispatch — the same action a drag
  // produces, so status stays derived from column membership. The dispatches
  // batch into one render and therefore one write to the file.
  const handleSubmit = (title: string, description: string, status: ColumnId) => {
    const now = Date.now();
    if (dialog?.mode === 'edit') {
      dispatch({ type: 'update', id: dialog.ticketId, title, description, updatedAt: now });
      if (status !== dialogStatus) {
        dispatch({ type: 'move', id: dialog.ticketId, to: status, index: state.columns[status].length });
      }
      setDialog({ mode: 'view', ticketId: dialog.ticketId }); // back to reading the ticket
    } else {
      const id = crypto.randomUUID();
      dispatch({
        type: 'create',
        ticket: { id, title, description, tags: [], createdAt: now, updatedAt: now },
      });
      if (status !== 'new') {
        dispatch({ type: 'move', id, to: status, index: state.columns[status].length });
      }
      setDialog(null);
    }
  };

  // Cross-column moves happen here, mid-drag, so the card visually joins the
  // column it hovers over. Within-column hovers dispatch nothing.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findColumn(state, activeId);
    const to = findColumn(state, overId);
    if (!from || !to || from === to) return;
    const overIndex = state.columns[to].indexOf(overId);
    dispatch({
      type: 'move',
      id: activeId,
      to,
      index: overIndex >= 0 ? overIndex : state.columns[to].length,
    });
  };

  // Final position within the destination column.
  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false); // resumes live refetches (deferred ones flush now)
    // Swallow the click the browser fires right after the drop (it dispatches
    // before this macrotask timeout runs, so real clicks are unaffected).
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);

    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const to = findColumn(state, overId);
    if (!to) return;
    const ids = state.columns[to];
    const newIndex = overId === to ? ids.length : ids.indexOf(overId);
    if (newIndex < 0 || ids.indexOf(activeId) === newIndex) return;
    dispatch({ type: 'move', id: activeId, to, index: newIndex });
  };

  if (!hydrated) {
    return <main className="board-status">Loading tickets…</main>;
  }

  return (
    <>
      {error && (
        <p className="board-error" role="alert">
          The board is out of sync: {error}. Recent changes may not be saved.
        </p>
      )}
      <BoardHeader
        featureId={featureId}
        featureName={featureName}
        boardFilePath={boardFilePath}
        conversation={state.conversation}
        query={query}
        tagFilter={tagFilter}
        tags={tags}
        shown={shownTickets}
        total={totalTickets}
        onQueryChange={setQuery}
        onTagFilterChange={setTagFilter}
        onClear={() => {
          setQuery('');
          setTagFilter('');
        }}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={() => setDragging(true)}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(false)}
      >
        <main className="board" aria-label="Ticket board">
          {COLUMN_IDS.map((columnId) => (
            <Column
              key={columnId}
              columnId={columnId}
              tickets={visible[columnId]}
              total={state.columns[columnId].length}
              filtering={filtering}
              allTags={tags}
              onAdd={columnId === 'new' ? () => setDialog({ mode: 'create' }) : undefined}
              onOpen={openTicket}
              onAddTag={(id, tag) => dispatch({ type: 'addTag', id, tag, updatedAt: Date.now() })}
              onRemoveTag={(id, tag) =>
                dispatch({ type: 'removeTag', id, tag, updatedAt: Date.now() })
              }
            />
          ))}
        </main>
      </DndContext>
      {dialog && (dialog.mode === 'create' || dialogTicket) && (
        <TicketDialog
          key={dialog.mode === 'create' ? 'create' : dialog.ticketId}
          mode={dialog.mode}
          ticket={dialogTicket}
          status={dialogStatus ?? 'new'}
          allTags={tags}
          featureId={featureId}
          featureName={featureName}
          boardFilePath={boardFilePath}
          onSubmit={handleSubmit}
          onAddTag={(tag) => {
            if (dialog.mode !== 'create')
              dispatch({ type: 'addTag', id: dialog.ticketId, tag, updatedAt: Date.now() });
          }}
          onRemoveTag={(tag) => {
            if (dialog.mode !== 'create')
              dispatch({ type: 'removeTag', id: dialog.ticketId, tag, updatedAt: Date.now() });
          }}
          onEdit={() => {
            if (dialog.mode === 'view') setDialog({ mode: 'edit', ticketId: dialog.ticketId });
          }}
          onCancel={() => {
            if (dialog.mode === 'edit') setDialog({ mode: 'view', ticketId: dialog.ticketId });
            else setDialog(null);
          }}
          onDelete={() => {
            if (dialog.mode !== 'create') dispatch({ type: 'delete', id: dialog.ticketId });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
