'use client';

import { useEffect, useRef, useState } from 'react';

interface TagEditorProps {
  tags: string[]; // this ticket's tags
  suggestions: string[]; // every tag in use across the board
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

// Inline tag pills with an add affordance, Azure DevOps style: '+' becomes a
// text input with a dropdown of existing tags; Enter (or clicking an option)
// commits, Escape or blur cancels.
export default function TagEditor({ tags, suggestions, onAdd, onRemove }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const options = suggestions.filter(
    (suggestion) =>
      !tags.includes(suggestion) &&
      suggestion.toLowerCase().includes(value.trim().toLowerCase()),
  );

  const commit = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
    setAdding(false);
  };

  const cancel = () => {
    setValue('');
    setAdding(false);
  };

  return (
    // stopPropagation: interacting with tags must never start a card drag or
    // a keyboard drag (the sortable listeners live on the card element).
    <span
      className="tag-editor"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {tags.map((tag) => (
        <span key={tag} className="tag-pill">
          <span className="tag-label">{tag}</span>
          <button
            type="button"
            className="tag-remove"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onRemove(tag)}
          >
            ×
          </button>
        </span>
      ))}
      {/* The slot is always input-sized, so swapping '+' for the input never
          shifts the layout around it. */}
      <span className="tag-add-slot">
        {adding ? (
          <>
            <input
              ref={inputRef}
              className="tag-input"
              value={value}
              placeholder="tag name"
              maxLength={40}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commit(value);
                } else if (event.key === 'Escape') {
                  // preventDefault so Escape only cancels the tag input, not a
                  // surrounding <dialog> (which closes on Escape by default).
                  event.preventDefault();
                  cancel();
                }
              }}
              onBlur={cancel}
            />
            {options.length > 0 && (
              <ul className="tag-options">
                {options.map((option) => (
                  <li key={option}>
                    {/* onMouseDown so it wins the race against the input's blur */}
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        commit(option);
                      }}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <button
            type="button"
            className="tag-add"
            aria-label="Add tag"
            title="Add tag"
            onClick={() => setAdding(true)}
          >
            +
          </button>
        )}
      </span>
    </span>
  );
}
