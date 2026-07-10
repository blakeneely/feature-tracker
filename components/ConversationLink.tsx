'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConversationRef } from '@/lib/board';

interface ConversationLinkProps {
  conversation: ConversationRef;
}

// Chip tying a board (masthead) or ticket (dialog view) back to the Claude
// Code conversation that created it. A browser can't open a terminal, so
// clicking copies the resume command; the tooltip carries the full reference.
export default function ConversationLink({ conversation }: ConversationLinkProps) {
  const command = `claude --resume ${conversation.sessionId}`;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the tooltip still shows the command.
    }
  };

  return (
    <button
      type="button"
      className={copied ? 'conversation-link copied' : 'conversation-link'}
      onClick={copy}
      title={`Claude Code conversation\nWorking dir: ${conversation.cwd}\nTranscript: ${conversation.transcriptPath}\n\nClick to copy: ${command}`}
    >
      {/* The hidden sizer always holds the longest label, so the button keeps
          one width and the header never shifts when the text flips. */}
      <span className="conversation-link-sizer" aria-hidden="true">
        ⧉ conversation
      </span>
      <span className="conversation-link-label">{copied ? 'copied ✓' : '⧉ conversation'}</span>
    </button>
  );
}
