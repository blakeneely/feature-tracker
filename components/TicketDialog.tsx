'use client';

import { useEffect, useRef, useState } from 'react';
import AgentTaskLink from '@/components/AgentTaskLink';
import ArtifactLink from '@/components/ArtifactLink';
import ConversationLink from '@/components/ConversationLink';
import TagEditor from '@/components/TagEditor';
import { COLUMN_LABELS, formatTicketNumber, type ColumnId, type Ticket } from '@/lib/board';

export type DialogMode = 'view' | 'edit' | 'create';

interface TicketDialogProps {
  mode: DialogMode;
  ticket?: Ticket; // present for view/edit, absent for create
  status: ColumnId; // current column (view/edit) or default placement (create)
  statuses: ColumnId[]; // this board's columns, in order — uat only if the board has it
  allTags: string[]; // suggestions for the tag editor
  featureId: string; // board id — for the ticket's agent-link reference
  featureName: string; // board name — for the ticket's agent-link reference
  boardFilePath: string; // absolute path to this board's file — for the agent-link reference
  onSubmit: (title: string, description: string, status: ColumnId) => void;
  onEdit: () => void; // view → edit
  onCancel: () => void; // edit → back to view; create → close
  onDelete: () => void;
  onClose: () => void;
  // Tags commit immediately in both view and edit mode (like the card pills);
  // Save/Cancel govern only title, notes, and status.
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// One large dialog for viewing, editing, and creating tickets. Cards open in
// view mode (room to read notes); Edit switches to the form in place.
// Status is not a ticket field — picking one becomes a 'move' dispatch in
// Board, same as a drag (see CLAUDE.md).
export default function TicketDialog({
  mode,
  ticket,
  status,
  statuses,
  allTags,
  featureId,
  featureName,
  boardFilePath,
  onSubmit,
  onEdit,
  onCancel,
  onDelete,
  onClose,
  onAddTag,
  onRemoveTag,
}: TicketDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [description, setDescription] = useState(ticket?.description ?? '');
  const [draftStatus, setDraftStatus] = useState<ColumnId>(status);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Re-seed the form each time editing starts, so it always reflects the
  // ticket as it currently is (an agent may have changed it while viewing).
  useEffect(() => {
    if (mode !== 'view') {
      setTitle(ticket?.title ?? '');
      setDescription(ticket?.description ?? '');
      setDraftStatus(status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const trimmedTitle = title.trim();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedTitle) return; // whitespace-only titles are never saved
    onSubmit(trimmedTitle, description.trim(), draftStatus);
  };

  return (
    <dialog ref={dialogRef} className="ticket-dialog" onClose={onClose}>
      {mode === 'view' && ticket ? (
        <div className="dialog-view">
          <header className="dialog-view-meta">
            <span className="ticket-number">{formatTicketNumber(ticket.number)}</span>
            <span className="dialog-status">{COLUMN_LABELS[status]}</span>
            <TagEditor
              tags={ticket.tags}
              suggestions={allTags}
              onAdd={onAddTag}
              onRemove={onRemoveTag}
            />
          </header>
          <h2 className="dialog-view-title">{ticket.title}</h2>
          <div className="dialog-view-description">
            {ticket.description || (
              <span className="dialog-view-empty">No notes yet. Edit the ticket to add some.</span>
            )}
          </div>
          <div className="dialog-view-footer">
            <p className="dialog-view-dates">
              Opened {fullDate.format(ticket.createdAt)} · Updated{' '}
              {fullDate.format(ticket.updatedAt)}
            </p>
            <div className="dialog-view-links">
              {ticket.artifacts?.map((artifact) => (
                <ArtifactLink key={artifact.url} artifact={artifact} />
              ))}
              {ticket.conversation && <ConversationLink conversation={ticket.conversation} />}
              <AgentTaskLink
                featureId={featureId}
                featureName={featureName}
                boardFilePath={boardFilePath}
                ticket={{ number: ticket.number, title: ticket.title }}
              />
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" className="danger-outline" onClick={onDelete}>
              Delete
            </button>
            <span className="dialog-actions-spacer" />
            <button type="button" className="quiet" onClick={onClose}>
              Close
            </button>
            <button type="button" className="primary" onClick={onEdit}>
              Edit
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h2>{mode === 'edit' ? `Edit ${formatTicketNumber(ticket?.number ?? 0)}` : 'New ticket'}</h2>
          {mode === 'edit' && ticket && (
            <div className="dialog-tags-field">
              <span className="dialog-field-label">Tags — applied immediately</span>
              <TagEditor
                tags={ticket.tags}
                suggestions={allTags}
                onAdd={onAddTag}
                onRemove={onRemoveTag}
              />
            </div>
          )}
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label>
            Notes
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={14}
            />
          </label>
          <label className="dialog-status-field">
            Status
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as ColumnId)}
            >
              {statuses.map((columnId) => (
                <option key={columnId} value={columnId}>
                  {COLUMN_LABELS[columnId]}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-actions">
            <button type="button" className="quiet" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!trimmedTitle}>
              {mode === 'edit' ? 'Save changes' : 'Create ticket'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
