'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TicketCard from '@/components/TicketCard';
import { COLUMN_LABELS, type ColumnId, type Ticket } from '@/lib/board';

interface ColumnProps {
  columnId: ColumnId;
  tickets: Ticket[]; // visible (possibly filtered) tickets, passed down from Board
  total: number; // unfiltered count for this column
  filtering: boolean;
  allTags: string[]; // suggestions for the tag editors
  onAdd?: () => void; // only the New column offers creation
  onOpen: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
}

export default function Column({
  columnId,
  tickets,
  total,
  filtering,
  allTags,
  onAdd,
  onOpen,
  onAddTag,
  onRemoveTag,
}: ColumnProps) {
  // The whole section is a drop target so cards can be dropped on an empty
  // column, not just on other cards.
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  const emptyText = filtering
    ? 'No tickets match the current filters.'
    : columnId === 'new'
      ? 'No tickets yet. Add one to get started.'
      : 'Nothing here yet.';

  return (
    <section
      ref={setNodeRef}
      className={`column column-${columnId}${isOver ? ' column-over' : ''}`}
      aria-label={COLUMN_LABELS[columnId]}
    >
      <header className="column-header">
        <h2 className="column-title">{COLUMN_LABELS[columnId]}</h2>
        <span className="column-count">{filtering ? `${tickets.length}/${total}` : total}</span>
        {onAdd && (
          <button type="button" className="add-ticket" onClick={onAdd}>
            Add ticket
          </button>
        )}
      </header>
      <SortableContext
        items={tickets.map((ticket) => ticket.id)}
        strategy={verticalListSortingStrategy}
      >
        {tickets.length === 0 ? (
          <p className="column-empty">{emptyText}</p>
        ) : (
          <ul className="ticket-list">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  ticket={ticket}
                  allTags={allTags}
                  onOpen={() => onOpen(ticket.id)}
                  onAddTag={(tag) => onAddTag(ticket.id, tag)}
                  onRemoveTag={(tag) => onRemoveTag(ticket.id, tag)}
                />
              </li>
            ))}
          </ul>
        )}
      </SortableContext>
    </section>
  );
}
