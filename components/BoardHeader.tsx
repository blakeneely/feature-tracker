'use client';

import ConversationLink from '@/components/ConversationLink';
import type { ConversationRef } from '@/lib/board';

interface BoardHeaderProps {
  featureName: string; // this board's title — the app title lives in the sidebar
  conversation?: ConversationRef; // the conversation that triggered this board, if recorded
  query: string;
  tagFilter: string; // '' = all tags
  tags: string[]; // distinct tags in use
  shown: number;
  total: number;
  onQueryChange: (query: string) => void;
  onTagFilterChange: (tag: string) => void;
  onClear: () => void;
}

export default function BoardHeader({
  featureName,
  conversation,
  query,
  tagFilter,
  tags,
  shown,
  total,
  onQueryChange,
  onTagFilterChange,
  onClear,
}: BoardHeaderProps) {
  const filtering = query.trim() !== '' || tagFilter !== '';

  return (
    <header className="masthead">
      <div className="masthead-title">
        {/* title attr: the h1 ellipsizes rather than wrapping the masthead row */}
        <h1 title={featureName}>{featureName}</h1>
      </div>
      <div className="masthead-controls">
        {conversation && (
          <span className="control">
            <span className="control-label">Origin</span>
            <ConversationLink conversation={conversation} />
          </span>
        )}
        <label className="control control-search">
          <span className="control-label">Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="id, title, or tag"
          />
        </label>
        <label className="control">
          <span className="control-label">Tag</span>
          <select
            value={tagFilter}
            onChange={(event) => onTagFilterChange(event.target.value)}
            disabled={tags.length === 0}
            title={tags.length === 0 ? 'Tags appear here once tickets have them' : undefined}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <span className="filter-status">
            <span className="filter-count">
              {shown} of {total}
            </span>
            <button type="button" className="filter-clear" onClick={onClear}>
              Clear
            </button>
          </span>
        )}
      </div>
    </header>
  );
}
