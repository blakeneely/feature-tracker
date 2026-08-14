'use client';

import AgentTaskLink from '@/components/AgentTaskLink';
import ArtifactLink from '@/components/ArtifactLink';
import ConversationLink from '@/components/ConversationLink';
import type { ArtifactRef, ConversationRef } from '@/lib/board';

interface BoardHeaderProps {
  featureId: string; // board id — for the agent-link reference
  featureName: string; // this board's title — the app title lives in the sidebar
  boardFilePath: string; // absolute path to this board's file — for the agent-link reference
  conversation?: ConversationRef; // the conversation that triggered this board, if recorded
  artifacts?: ArtifactRef[]; // published artifacts about this board's work, if recorded
  uatEnabled: boolean; // whether this board has the optional UAT column
  uatCount: number; // tickets currently in UAT — disabling is blocked until 0
  onToggleUat: (enabled: boolean) => void;
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
  featureId,
  featureName,
  boardFilePath,
  conversation,
  artifacts,
  uatEnabled,
  uatCount,
  onToggleUat,
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
      {/* Nameplate: the board title with its provenance chips (where this
          board came from, how to hand it off) set to the right like a
          broadsheet's edition line. */}
      <div className="masthead-nameplate">
        <div className="masthead-title">
          {/* title attr: the h1 ellipsizes rather than wrapping the nameplate row */}
          <h1 title={featureName}>{featureName}</h1>
        </div>
        <div className="masthead-provenance">
          {conversation && (
            <span className="control">
              <span className="control-label">Origin</span>
              <ConversationLink conversation={conversation} />
            </span>
          )}
          {artifacts && artifacts.length > 0 && (
            <span className="control">
              <span className="control-label">{artifacts.length === 1 ? 'Artifact' : 'Artifacts'}</span>
              {artifacts.map((artifact) => (
                <ArtifactLink key={artifact.url} artifact={artifact} />
              ))}
            </span>
          )}
          <span className="control">
            <span className="control-label">Hand off</span>
            <AgentTaskLink
              featureId={featureId}
              featureName={featureName}
              boardFilePath={boardFilePath}
            />
          </span>
          {/* Per-board UAT column toggle. Turning it off is blocked while the
              column holds tickets — a toggle never changes a ticket's status. */}
          <span className="control">
            <span className="control-label">UAT column</span>
            <button
              type="button"
              className={`uat-toggle${uatEnabled ? ' uat-toggle-on' : ''}`}
              aria-pressed={uatEnabled}
              disabled={uatEnabled && uatCount > 0}
              title={
                uatEnabled && uatCount > 0
                  ? `Move ${uatCount === 1 ? 'the ticket' : `all ${uatCount} tickets`} out of UAT before turning it off`
                  : uatEnabled
                    ? 'Remove the UAT column from this board'
                    : 'Add a UAT column between Active and Resolved'
              }
              onClick={() => onToggleUat(!uatEnabled)}
            >
              {uatEnabled ? 'On' : 'Off'}
            </button>
          </span>
        </div>
      </div>
      {/* Folio line: a fine rule under the nameplate, then the reader's
          filters, with the result count trailing at the far right. */}
      <div className="masthead-filters">
        <label className="control control-search">
          <span className="control-label">Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="id, title, or tag"
          />
        </label>
        {/* Right cluster: the result count sits just left of the Tag
            dropdown so Tag stays pinned to the far right in every state. */}
        <div className="masthead-filters-end">
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
        </div>
      </div>
    </header>
  );
}
