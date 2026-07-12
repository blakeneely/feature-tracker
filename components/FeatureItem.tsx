'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Feature } from '@/lib/features';

interface FeatureItemProps {
  feature: Feature;
  selected: boolean;
  unseen: boolean; // board changed while another feature was selected
  onSelect: () => void;
  onStartRename: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
}

// One sortable row in the feature sidebar — same drag idiom as TicketCard:
// the whole row drags, and the sensors' 5px activation distance is what lets
// the select/rename/done/delete buttons take plain clicks.
export default function FeatureItem({
  feature,
  selected,
  unseen,
  onSelect,
  onStartRename,
  onToggleDone,
  onDelete,
}: FeatureItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });

  const className = [
    'feature-item',
    selected && 'feature-active',
    feature.done && 'feature-done',
    isDragging && 'feature-dragging',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={className}
      {...attributes}
      {...listeners}
    >
      {/* The gutter is always rendered so titles align across rows; the dot
          only becomes visible while the board has unseen changes. */}
      <span
        className={unseen ? 'feature-unseen-dot unseen' : 'feature-unseen-dot'}
        role={unseen ? 'img' : undefined}
        title={unseen ? 'Unseen changes' : undefined}
        aria-label={unseen ? `${feature.name} has unseen changes` : undefined}
        aria-hidden={unseen ? undefined : true}
      />
      <button type="button" className="feature-name" onClick={onSelect} title={feature.name}>
        {feature.name}
      </button>
      {/* stopPropagation keeps Space/Enter on the buttons from bubbling to
          the row's keyboard-drag listener and starting a drag instead. */}
      <span className="feature-actions" onKeyDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={feature.done ? 'done-toggle done' : 'done-toggle'}
          aria-label={feature.done ? `Mark ${feature.name} not done` : `Mark ${feature.name} done`}
          title={feature.done ? 'Mark not done' : 'Mark done'}
          onClick={onToggleDone}
        >
          ✓
        </button>
        <button
          type="button"
          aria-label={`Rename ${feature.name}`}
          title="Rename"
          onClick={onStartRename}
        >
          ✎
        </button>
        <button
          type="button"
          className="danger"
          aria-label={`Delete ${feature.name}`}
          title="Delete board"
          onClick={onDelete}
        >
          ×
        </button>
      </span>
    </li>
  );
}
