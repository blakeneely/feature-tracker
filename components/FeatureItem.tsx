'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Feature } from '@/lib/features';

interface FeatureItemProps {
  feature: Feature;
  selected: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onDelete: () => void;
}

// One sortable row in the feature sidebar — same drag idiom as TicketCard:
// the whole row drags, and the sensors' 5px activation distance is what lets
// the select/rename/delete buttons take plain clicks.
export default function FeatureItem({
  feature,
  selected,
  onSelect,
  onStartRename,
  onDelete,
}: FeatureItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });

  const className = [
    'feature-item',
    selected && 'feature-active',
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
      <button type="button" className="feature-name" onClick={onSelect} title={feature.name}>
        {feature.name}
      </button>
      {/* stopPropagation keeps Space/Enter on the buttons from bubbling to
          the row's keyboard-drag listener and starting a drag instead. */}
      <span className="feature-actions" onKeyDown={(event) => event.stopPropagation()}>
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
