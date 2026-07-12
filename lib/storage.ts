// Server-only file I/O for the data directory — the single source of truth,
// shared with terminal agents. Only the API routes import this.
//
// Layout:
//   data/features.json      — index of features (id, name, order)
//   data/boards/<id>.json   — one board file per feature, v3 board shape
//
// A legacy single-board data/tickets.json migrates on first read: it moves to
// data/boards/general.json and the index gets a "General" feature.

import { mkdirSync, watch, type FSWatcher } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DATA_VERSION,
  initialState,
  isBoardFile,
  migrateLegacyBoardFile,
  type BoardFile,
} from '@/lib/board';
import {
  FEATURES_VERSION,
  emptyFeaturesFile,
  isFeatureId,
  isFeaturesFile,
  type FeaturesFile,
} from '@/lib/features';

const DATA_DIR = path.join(process.cwd(), 'data');
const BOARDS_DIR = path.join(DATA_DIR, 'boards');
const FEATURES_PATH = path.join(DATA_DIR, 'features.json');
const LEGACY_TICKETS_PATH = path.join(DATA_DIR, 'tickets.json');

function boardPath(featureId: string): string {
  // Ids come from URLs — never let one that isn't a plain slug touch the fs.
  if (!isFeatureId(featureId)) throw new Error(`Invalid feature id: ${featureId}`);
  return path.join(BOARDS_DIR, `${featureId}.json`);
}

// All writes are serialized and atomic (temp file + rename) so a concurrent
// reader — including a terminal agent — never sees a half-written file, and
// two API calls can't interleave a read-modify-write of the index.
let writeQueue: Promise<unknown> = Promise.resolve();
let writeCount = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => {}); // one failed write must not wedge the queue
  return run;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${writeCount++}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(tempPath, filePath);
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

// ---------- change notification ----------

// One fs.watch over data/ shared by every listener (SSE connections), so the
// UI can refetch the moment anything writes a file — the API or a terminal
// agent editing boards directly. Recursive to cover data/boards/. The .tmp
// files from atomic writes are ignored; each one is followed by a rename
// event on the real file anyway.
const watchListeners = new Set<() => void>();
let watcher: FSWatcher | null = null;

export function watchDataDir(listener: () => void): () => void {
  if (!watcher) {
    mkdirSync(BOARDS_DIR, { recursive: true }); // fs.watch needs the tree to exist
    watcher = watch(DATA_DIR, { recursive: true }, (_event, filename) => {
      if (filename?.endsWith('.tmp')) return;
      for (const notify of watchListeners) notify();
    });
  }
  watchListeners.add(listener);
  return () => {
    watchListeners.delete(listener);
    if (watchListeners.size === 0 && watcher) {
      watcher.close();
      watcher = null;
    }
  };
}

// ---------- features index ----------

export async function readFeaturesFile(): Promise<FeaturesFile> {
  const parsed = await readJson(FEATURES_PATH);
  if (parsed !== undefined) {
    if (isFeaturesFile(parsed)) return parsed;
    throw new Error(
      `data/features.json is not a valid version-${FEATURES_VERSION} index — fix or delete it (it will be re-seeded)`,
    );
  }

  // First read ever (or the index was deleted): seed it, absorbing a legacy
  // single-board tickets.json as the "General" feature if one exists.
  return enqueue(async () => {
    const legacy = await readJson(LEGACY_TICKETS_PATH);
    if (legacy === undefined) {
      await writeJsonAtomic(FEATURES_PATH, emptyFeaturesFile);
      return emptyFeaturesFile;
    }
    await mkdir(BOARDS_DIR, { recursive: true });
    await rename(LEGACY_TICKETS_PATH, path.join(BOARDS_DIR, 'general.json'));
    const now = Date.now();
    const seeded: FeaturesFile = {
      version: FEATURES_VERSION,
      features: [{ id: 'general', name: 'General', createdAt: now, updatedAt: now }],
    };
    await writeJsonAtomic(FEATURES_PATH, seeded);
    return seeded;
  });
}

// Serialized read-modify-write of the index. The mutator returns the file to
// write, or null to leave the index untouched (e.g. renaming a missing id).
export async function mutateFeaturesFile(
  mutate: (current: FeaturesFile) => FeaturesFile | null,
): Promise<FeaturesFile> {
  const current = await readFeaturesFile(); // runs migration outside the queue if needed
  return enqueue(async () => {
    const next = mutate(current);
    if (next === null) return current;
    await writeJsonAtomic(FEATURES_PATH, next);
    return next;
  });
}

// ---------- per-feature boards ----------

export async function readBoardFile(featureId: string): Promise<BoardFile> {
  const filePath = boardPath(featureId);
  const parsed = await readJson(filePath);
  if (parsed === undefined) {
    // Listed in the index but file missing (deleted by hand) — re-seed empty.
    const seed: BoardFile = { version: DATA_VERSION, ...initialState };
    await writeBoardFile(featureId, seed);
    return seed;
  }
  if (isBoardFile(parsed)) return parsed;

  // Legacy files (v1: no numbers/tags, v2: single tag) migrate in place on first read.
  const migrated = migrateLegacyBoardFile(parsed);
  if (migrated) {
    await writeBoardFile(featureId, migrated);
    return migrated;
  }
  throw new Error(
    `data/boards/${featureId}.json is not a valid version-${DATA_VERSION} board file (or a migratable legacy file) — fix or delete it (it will be re-seeded empty)`,
  );
}

export function writeBoardFile(featureId: string, file: BoardFile): Promise<void> {
  const filePath = boardPath(featureId); // validate before entering the queue
  return enqueue(() => writeJsonAtomic(filePath, file));
}

export function deleteBoardFile(featureId: string): Promise<void> {
  const filePath = boardPath(featureId);
  return enqueue(async () => {
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  });
}
