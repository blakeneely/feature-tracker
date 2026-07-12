'use client';

import { useEffect, useRef, useState } from 'react';
import { formatTicketNumber } from '@/lib/board';

interface AgentTaskLinkProps {
  featureId: string;
  featureName: string;
  boardFilePath: string; // absolute path to data/boards/<id>.json on this machine
  // Present => reference one ticket; absent => reference the whole board.
  ticket?: { number: number; title: string };
}

// A copyable pointer you hand to a fresh agent so it can go work this board
// (or one ticket) from any repo on this machine. The mirror image of
// ConversationLink: that one reopens the conversation that CREATED the item;
// this one points an agent AT the work. The reference is self-contained — it
// names the item and its absolute board-file path, so the target agent can
// read data/boards/<id>.json and act without the app running or any skill
// installed. Clicking copies it (the tooltip carries the full text).
export default function AgentTaskLink({
  featureId,
  featureName,
  boardFilePath,
  ticket,
}: AgentTaskLinkProps) {
  const reference = ticket
    ? `Feature Tracker ticket ${formatTicketNumber(ticket.number)} "${ticket.title}" on board "${featureName}" (id: ${featureId})\nBoard file: ${boardFilePath}`
    : `Feature Tracker board "${featureName}" (id: ${featureId})\nBoard file: ${boardFilePath}`;

  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the tooltip still shows the reference.
    }
  };

  return (
    <button
      type="button"
      className={copied ? 'agent-link copied' : 'agent-link'}
      onClick={copy}
      title={`Copy a reference to hand to an agent:\n\n${reference}`}
    >
      {/* Hidden sizer holds the longest label so the button keeps one width
          and the row never shifts when the text flips to "copied ✓". */}
      <span className="agent-link-sizer" aria-hidden="true">
        ⧉ agent link
      </span>
      <span className="agent-link-label">{copied ? 'copied ✓' : '⧉ agent link'}</span>
    </button>
  );
}
