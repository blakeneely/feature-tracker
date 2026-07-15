import type { ArtifactRef } from '@/lib/board';

interface ArtifactLinkProps {
  artifact: ArtifactRef;
}

// Chip for a published artifact attached to a board (masthead "Artifacts") or
// ticket (dialog view). Unlike ConversationLink/AgentTaskLink — which copy
// text for a terminal — an artifact is a web page, so this is a real link
// that opens it in a new tab. Written only by agents; the UI just displays it.
export default function ArtifactLink({ artifact }: ArtifactLinkProps) {
  return (
    <a
      className="artifact-link"
      href={artifact.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${artifact.title}\n${artifact.url}\n\nOpens in a new tab`}
    >
      <span aria-hidden="true">↗</span>
      <span className="artifact-link-title">{artifact.title}</span>
    </a>
  );
}
