import { isBoardFile } from '@/lib/board';
import { readBoardFile, readFeaturesFile, writeBoardFile } from '@/lib/storage';

// One feature's board of tickets — the same contract the single-board
// /api/tickets route used to have, scoped to data/boards/<id>.json.
// Terminal agents may call these endpoints or edit the file directly.

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function featureExists(id: string): Promise<boolean> {
  const index = await readFeaturesFile();
  return index.features.some((feature) => feature.id === id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await featureExists(id))) {
      return Response.json({ error: `No feature with id '${id}'` }, { status: 404 });
    }
    return Response.json(await readBoardFile(id));
  } catch (error) {
    return Response.json(
      { error: `Could not read the board file: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}

// Whole-board replace, last write wins (see CLAUDE.md — no locking). Writes
// only touch this feature's file, so agents on other boards are unaffected.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  if (!isBoardFile(body)) {
    return Response.json(
      {
        error:
          'Body must be a well-formed board file: { version: 3, tickets, columns, nextNumber } with every ticket placed in exactly one column, carrying a unique number below nextNumber and a tags array of unique non-empty strings; the board and any ticket may carry an optional conversation { sessionId, cwd, transcriptPath } of non-empty strings and an optional artifacts array of { title, url } with non-empty title and http(s) url (see CLAUDE.md)',
      },
      { status: 400 },
    );
  }
  try {
    if (!(await featureExists(id))) {
      return Response.json({ error: `No feature with id '${id}'` }, { status: 404 });
    }
    await writeBoardFile(id, body);
    return Response.json(body);
  } catch (error) {
    return Response.json(
      { error: `Could not write the board file: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}
