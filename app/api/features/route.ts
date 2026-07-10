import { DATA_VERSION, initialState, type BoardFile } from '@/lib/board';
import { nextFeatureId, reorderFeatures, type Feature } from '@/lib/features';
import { mutateFeaturesFile, readFeaturesFile, writeBoardFile } from '@/lib/storage';

// Feature index: list boards, create new ones, reorder the sidebar. Terminal
// agents can call this to find the board for a feature by name (see CLAUDE.md).

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  try {
    return Response.json(await readFeaturesFile());
  } catch (error) {
    return Response.json(
      { error: `Could not read the feature index: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}

// POST { name } — creates the feature and its empty board file, returns the
// new feature. The id is the name's slug, fixed for the board's lifetime.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  const name =
    typeof body === 'object' && body !== null && typeof (body as { name?: unknown }).name === 'string'
      ? ((body as { name: string }).name).trim()
      : '';
  if (!name) {
    return Response.json({ error: 'Body must be { name: string } with a non-empty name' }, { status: 400 });
  }

  try {
    let created: Feature | undefined;
    await mutateFeaturesFile((current) => {
      const taken = new Set(current.features.map((feature) => feature.id));
      const now = Date.now();
      created = { id: nextFeatureId(name, taken), name, createdAt: now, updatedAt: now };
      return { ...current, features: [...current.features, created] };
    });
    // Seed the board file so agents can start writing tickets immediately.
    const seed: BoardFile = { version: DATA_VERSION, ...initialState };
    await writeBoardFile(created!.id, seed);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: `Could not create the feature: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}

// PUT { ids } — set the display order. ids must be a permutation of every
// current feature id; a stale list (feature created or deleted since the
// caller read the index) gets a 409 rather than silently dropping entries.
// Returns the reordered index.
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  const ids =
    typeof body === 'object' && body !== null && Array.isArray((body as { ids?: unknown }).ids)
      ? ((body as { ids: unknown[] }).ids)
      : null;
  if (!ids || !ids.every((id): id is string => typeof id === 'string')) {
    return Response.json({ error: 'Body must be { ids: string[] }' }, { status: 400 });
  }

  try {
    let applied = false;
    const file = await mutateFeaturesFile((current) => {
      const features = reorderFeatures(current.features, ids);
      if (!features) return null;
      applied = true;
      return { ...current, features };
    });
    if (!applied) {
      return Response.json(
        { error: 'ids must be a permutation of the current feature ids — refetch the index and retry' },
        { status: 409 },
      );
    }
    return Response.json(file);
  } catch (error) {
    return Response.json(
      { error: `Could not reorder the features: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}
