import { deleteBoardFile, mutateFeaturesFile } from '@/lib/storage';

// Rename and delete a feature. The board filename never changes on rename —
// only the display name in the index does (see CLAUDE.md).

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// PATCH { name } — rename.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    let found = false;
    const file = await mutateFeaturesFile((current) => {
      const features = current.features.map((feature) => {
        if (feature.id !== id) return feature;
        found = true;
        return { ...feature, name, updatedAt: Date.now() };
      });
      return found ? { ...current, features } : null;
    });
    if (!found) return Response.json({ error: `No feature with id '${id}'` }, { status: 404 });
    return Response.json(file.features.find((feature) => feature.id === id));
  } catch (error) {
    return Response.json(
      { error: `Could not rename the feature: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}

// DELETE — removes the feature from the index and deletes its board file
// (and every ticket on it) permanently.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let found = false;
    await mutateFeaturesFile((current) => {
      const features = current.features.filter((feature) => feature.id !== id);
      found = features.length !== current.features.length;
      return found ? { ...current, features } : null;
    });
    if (!found) return Response.json({ error: `No feature with id '${id}'` }, { status: 404 });
    await deleteBoardFile(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: `Could not delete the feature: ${errorMessage(error)}` },
      { status: 500 },
    );
  }
}
