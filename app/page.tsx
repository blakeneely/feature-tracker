import path from 'node:path';
import Workspace from '@/components/Workspace';

// Server component: resolve the boards directory from the running server's cwd
// (same root storage.ts uses) and hand it to the client so the agent-link
// buttons can name each board file's absolute path. No client fetch needed —
// it's constant for the process lifetime.
export default function Home() {
  const boardsDir = path.join(process.cwd(), 'data', 'boards');
  return <Workspace boardsDir={boardsDir} pathSep={path.sep} />;
}
