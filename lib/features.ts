// Pure feature-index domain logic — no React or Node imports here (see
// CLAUDE.md). A "feature" is one board of tickets; data/features.json lists
// them and data/boards/<id>.json holds each board.

export interface Feature {
  id: string; // slug, fixed at creation — the board's filename never changes on rename
  name: string; // display name, editable
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  done?: boolean; // marked done in the sidebar; absent = not done
}

export interface FeaturesFile {
  version: number; // 1 — bump on shape migration
  features: Feature[]; // display order
}

export const FEATURES_VERSION = 1;

export const emptyFeaturesFile: FeaturesFile = {
  version: FEATURES_VERSION,
  features: [],
};

// Ids double as filenames under data/boards/ — this shape rules out path
// traversal and anything a filesystem would mangle.
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isFeatureId(value: string): boolean {
  return ID_PATTERN.test(value);
}

// 'Benchmarking chart refactor' → 'benchmarking-chart-refactor'. May return
// '' for names with no usable characters — callers must fall back.
export function slugifyFeatureName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

// A unique id for a new feature: the name's slug, suffixed -2, -3, … when a
// board with that slug already exists (or existed — ids of deleted features
// may be reused only if their board file is gone; the caller passes every id
// it must avoid).
export function nextFeatureId(name: string, taken: Set<string>): string {
  const base = slugifyFeatureName(name) || 'feature';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Reorder the index to match ids exactly. Returns null unless ids is a
// permutation of the current feature ids — a stale list (a feature created or
// deleted since the caller read the index) must not silently drop or
// duplicate entries.
export function reorderFeatures(features: Feature[], ids: string[]): Feature[] | null {
  if (ids.length !== features.length) return null;
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const next: Feature[] = [];
  for (const id of ids) {
    const feature = byId.get(id);
    if (!feature) return null; // unknown or repeated id (map lookups are deleted below)
    byId.delete(id);
    next.push(feature);
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFeature(value: unknown): value is Feature {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    isFeatureId(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim() !== '' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.done === undefined || typeof value.done === 'boolean')
  );
}

// Guards the index at the file/API boundary, like isBoardFile does for
// boards: ids must be unique, every entry well-formed.
export function isFeaturesFile(value: unknown): value is FeaturesFile {
  if (!isRecord(value)) return false;
  if (value.version !== FEATURES_VERSION) return false;
  if (!Array.isArray(value.features)) return false;
  const ids = new Set<string>();
  for (const feature of value.features) {
    if (!isFeature(feature) || ids.has(feature.id)) return false;
    ids.add(feature.id);
  }
  return true;
}
