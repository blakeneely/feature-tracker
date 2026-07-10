// The single-board /api/tickets endpoint is gone — boards are now per
// feature. This stub answers old callers (agent prompts written before the
// multi-board change) with directions instead of a bare 404.

const guidance = {
  error:
    'This app now has one board per feature. GET /api/features lists them; ' +
    'use /api/features/<id>/tickets (same board format as before) or edit ' +
    'data/boards/<id>.json directly. The old single board lives on as the ' +
    "'general' feature (see CLAUDE.md).",
};

export async function GET() {
  return Response.json(guidance, { status: 410 });
}

export async function PUT() {
  return Response.json(guidance, { status: 410 });
}
