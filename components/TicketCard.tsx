'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TagEditor from '@/components/TagEditor';
import { formatTicketNumber, type Ticket } from '@/lib/board';

interface TicketCardProps {
  ticket: Ticket;
  allTags: string[]; // suggestions for the tag editor
  onOpen: () => void; // opens the large view dialog
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export default function TicketCard({
  ticket,
  allTags,
  onOpen,
  onAddTag,
  onRemoveTag,
}: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'ticket-card dragging' : 'ticket-card'}
      {...attributes}
      {...listeners}
    >
      <div className="ticket-meta">
        <h3 className="ticket-title">
          <button type="button" className="ticket-open" onClick={onOpen}>
            {ticket.title}
          </button>
        </h3>
        <span className="ticket-number">{formatTicketNumber(ticket.number)}</span>
      </div>
      <div className="ticket-tags">
        <TagEditor
          tags={ticket.tags}
          suggestions={allTags}
          onAdd={onAddTag}
          onRemove={onRemoveTag}
        />
      </div>
      {ticket.description && <p className="ticket-description">{ticket.description}</p>}
      <footer className="ticket-footer">
        <time className="ticket-date" dateTime={new Date(ticket.createdAt).toISOString()}>
          Opened {dateFormat.format(ticket.createdAt)}
        </time>
      </footer>
    </article>
  );
}
