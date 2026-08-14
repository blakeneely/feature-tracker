// Pure board domain logic — no React or Node imports here (see CLAUDE.md).

export type ColumnId = 'new' | 'active' | 'uat' | 'resolved';

// The UAT column is per-board opt-in: a board has it iff its columns object
// carries a `uat` key (an empty array counts). New boards get it by default;
// pre-UAT 3-column boards stay valid untouched — no version bump, no
// migration. The masthead toggle adds or removes the key.
export type BoardColumns = Record<Exclude<ColumnId, 'uat'>, string[]> & { uat?: string[] };

// Link back to the Claude Code conversation that created a board or ticket.
// Written only by agents (the UI just displays it); resume with
// `claude --resume <sessionId>` from cwd, or read the transcript directly.
export interface ConversationRef {
  sessionId: string; // Claude Code session UUID
  cwd: string; // working directory the conversation ran in
  transcriptPath: string; // absolute path to the session's .jsonl transcript
}

// A published web artifact (e.g. a claude.ai/code artifact page) attached to
// a board or ticket. Written only by agents (the UI just displays it) as a
// chip that opens the URL in a new tab.
export interface ArtifactRef {
  title: string; // short human label, shown as the chip text
  url: string; // http(s) URL the chip opens
}

export interface Ticket {
  id: string; // crypto.randomUUID()
  number: number; // sequential visual id (#0042) — assigned by the reducer, never reused
  title: string;
  description: string;
  tags: string[]; // unique, non-empty strings; [] = untagged
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  conversation?: ConversationRef; // the conversation that created this ticket, if not the board's own
  artifacts?: ArtifactRef[]; // published artifacts about this ticket's work
}

export interface BoardState {
  tickets: Record<string, Ticket>;
  columns: BoardColumns; // ordered ticket ids; status is derived from membership; uat optional per board
  nextNumber: number; // next visual id to assign; agents writing the file must bump it too
  conversation?: ConversationRef; // the conversation that triggered this board's creation
  artifacts?: ArtifactRef[]; // published artifacts about this board's work
}

export type BoardAction =
  | { type: 'hydrate'; state: BoardState }
  | { type: 'create'; ticket: Omit<Ticket, 'number'> } // reducer assigns the number
  | { type: 'update'; id: string; title: string; description: string; updatedAt: number }
  | { type: 'addTag'; id: string; tag: string; updatedAt: number }
  | { type: 'removeTag'; id: string; tag: string; updatedAt: number }
  | { type: 'delete'; id: string }
  | { type: 'move'; id: string; to: ColumnId; index: number }
  // Adds/removes the board's uat column. Disabling is refused (no-op) while
  // uat holds tickets — a toggle must never change a ticket's status.
  | { type: 'setUat'; enabled: boolean };

// Full display order; boards without a uat key skip it (see BoardColumns).
export const COLUMN_IDS: ColumnId[] = ['new', 'active', 'uat', 'resolved'];

// Columns every board must have — only uat is optional.
const REQUIRED_COLUMN_IDS: ColumnId[] = ['new', 'active', 'resolved'];

// The columns present on one board, in display order.
export function boardColumnIds(columns: BoardColumns): ColumnId[] {
  return COLUMN_IDS.filter((columnId) => columns[columnId] !== undefined);
}

export const COLUMN_LABELS: Record<ColumnId, string> = {
  new: 'New',
  active: 'Active',
  uat: 'UAT',
  resolved: 'Resolved',
};

// Version 3 covers both 3- and 4-column boards — the uat key's presence,
// not the version, signals UAT (so pre-UAT files and agents stay valid).
export const DATA_VERSION = 3;

// Shape of data/boards/<id>.json — the single source of truth, shared with
// terminal agents (see CLAUDE.md).
export interface BoardFile extends BoardState {
  version: number;
}

// New boards get the uat column by default; older boards opt in via the toggle.
export const initialState: BoardState = {
  tickets: {},
  columns: { new: [], active: [], uat: [], resolved: [] },
  nextNumber: 1,
};

export function formatTicketNumber(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}

// Distinct tags currently in use, for the filter dropdown and tag suggestions.
export function distinctTags(tickets: Record<string, Ticket>): string[] {
  const tags = new Set<string>();
  for (const ticket of Object.values(tickets)) {
    for (const tag of ticket.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

// Search matches ticket number (with or without '#' and leading zeros),
// title substring, or any tag substring — all case-insensitive.
export function ticketMatches(ticket: Ticket, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const digits = query.replace(/^#/, '');
  if (/^\d+$/.test(digits) && String(ticket.number).includes(String(parseInt(digits, 10)))) {
    return true;
  }
  return (
    ticket.title.toLowerCase().includes(query) ||
    ticket.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'create': {
      const ticket: Ticket = { ...action.ticket, number: state.nextNumber };
      return {
        ...state,
        nextNumber: state.nextNumber + 1,
        tickets: { ...state.tickets, [ticket.id]: ticket },
        columns: { ...state.columns, new: [...state.columns.new, ticket.id] },
      };
    }

    case 'update': {
      const existing = state.tickets[action.id];
      if (!existing) return state;
      return {
        ...state,
        tickets: {
          ...state.tickets,
          [action.id]: {
            ...existing,
            title: action.title,
            description: action.description,
            updatedAt: action.updatedAt,
          },
        },
      };
    }

    case 'addTag': {
      const existing = state.tickets[action.id];
      const tag = action.tag.trim();
      if (!existing || !tag || existing.tags.includes(tag)) return state;
      return {
        ...state,
        tickets: {
          ...state.tickets,
          [action.id]: { ...existing, tags: [...existing.tags, tag], updatedAt: action.updatedAt },
        },
      };
    }

    case 'removeTag': {
      const existing = state.tickets[action.id];
      if (!existing || !existing.tags.includes(action.tag)) return state;
      return {
        ...state,
        tickets: {
          ...state.tickets,
          [action.id]: {
            ...existing,
            tags: existing.tags.filter((tag) => tag !== action.tag),
            updatedAt: action.updatedAt,
          },
        },
      };
    }

    case 'delete': {
      if (!state.tickets[action.id]) return state;
      const tickets = { ...state.tickets };
      delete tickets[action.id];
      const columns = { ...state.columns };
      for (const columnId of boardColumnIds(columns)) {
        const ids = columns[columnId];
        if (ids) columns[columnId] = ids.filter((id) => id !== action.id);
      }
      return { ...state, tickets, columns };
    }

    case 'move': {
      if (!state.tickets[action.id]) return state;
      // A move into a column this board doesn't have (uat on a 3-column
      // board) is a no-op rather than silently losing the ticket.
      const targetIds = state.columns[action.to];
      if (!targetIds) return state;
      // Source column is derived, never trusted from the caller — a stale
      // 'from' during rapid drag events could duplicate or drop the ticket.
      const from = boardColumnIds(state.columns).find((columnId) =>
        state.columns[columnId]?.includes(action.id),
      );
      if (!from) return state;
      const source = (state.columns[from] ?? []).filter((id) => id !== action.id);
      const target = from === action.to ? source : [...targetIds];
      const index = Math.max(0, Math.min(action.index, target.length));
      target.splice(index, 0, action.id); // fresh array both ways — no state mutation
      return {
        ...state,
        columns: { ...state.columns, [from]: source, [action.to]: target },
      };
    }

    case 'setUat': {
      if (action.enabled) {
        if (state.columns.uat) return state;
        return { ...state, columns: { ...state.columns, uat: [] } };
      }
      // Refuse to disable while uat holds tickets — the UI blocks the toggle
      // in that state; this is the backstop.
      if (!state.columns.uat || state.columns.uat.length > 0) return state;
      const { uat: _uat, ...columns } = state.columns;
      return { ...state, columns };
    }

    default:
      return state;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidTags(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const tag of value) {
    if (typeof tag !== 'string' || tag.trim() === '' || seen.has(tag)) return false;
    seen.add(tag);
  }
  return true;
}

function isConversationRef(value: unknown): value is ConversationRef {
  if (!isRecord(value)) return false;
  return (
    typeof value.sessionId === 'string' &&
    value.sessionId.trim() !== '' &&
    typeof value.cwd === 'string' &&
    value.cwd.trim() !== '' &&
    typeof value.transcriptPath === 'string' &&
    value.transcriptPath.trim() !== ''
  );
}

function isArtifactRef(value: unknown): value is ArtifactRef {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    typeof value.url === 'string' &&
    /^https?:\/\/\S+$/.test(value.url)
  );
}

// undefined = no artifacts (the common case); present = every entry valid.
function isValidArtifacts(value: unknown): value is ArtifactRef[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(isArtifactRef));
}

function isTicket(value: unknown): value is Ticket {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    Number.isInteger(value.number) &&
    (value.number as number) > 0 &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isValidTags(value.tags) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.conversation === undefined || isConversationRef(value.conversation)) &&
    isValidArtifacts(value.artifacts)
  );
}

// Validates column structure: known keys only (uat optional — see
// BoardColumns), every id a string, placed exactly once, present in tickets.
// Shared by current-version validation and legacy migration.
function validPlacement(
  tickets: Record<string, unknown>,
  columns: Record<string, unknown>,
): Set<string> | null {
  for (const key of Object.keys(columns)) {
    if (!(COLUMN_IDS as string[]).includes(key)) return null;
  }
  if (!REQUIRED_COLUMN_IDS.every((columnId) => columnId in columns)) return null;
  const placed = new Set<string>();
  for (const columnId of COLUMN_IDS) {
    const ids = columns[columnId];
    if (ids === undefined) continue; // only uat can be absent (checked above)
    if (!Array.isArray(ids)) return null;
    for (const id of ids) {
      if (typeof id !== 'string' || placed.has(id) || !(id in tickets)) return null;
      placed.add(id);
    }
  }
  return placed;
}

// Guards everything that crosses the file/API boundary: the file is shared
// with external agents, so a malformed write must be rejected loudly rather
// than crash the board later.
export function isBoardFile(value: unknown): value is BoardFile {
  if (!isRecord(value)) return false;
  if (value.version !== DATA_VERSION) return false;
  if (!isRecord(value.tickets) || !isRecord(value.columns)) return false;
  if (!Number.isInteger(value.nextNumber) || (value.nextNumber as number) < 1) return false;
  if (value.conversation !== undefined && !isConversationRef(value.conversation)) return false;
  if (!isValidArtifacts(value.artifacts)) return false;

  const tickets = value.tickets as Record<string, unknown>;
  const placed = validPlacement(tickets, value.columns as Record<string, unknown>);
  if (!placed) return false;

  // Every ticket well-formed, keyed by its own id, placed somewhere, with a
  // unique visual number below nextNumber.
  const numbers = new Set<number>();
  for (const [id, ticket] of Object.entries(tickets)) {
    if (!isTicket(ticket) || ticket.id !== id || !placed.has(id)) return false;
    if (numbers.has(ticket.number) || ticket.number >= (value.nextNumber as number)) return false;
    numbers.add(ticket.number);
  }
  return true;
}

interface LegacyCommon {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

function legacyTicketCommon(value: unknown, id: string): LegacyCommon | null {
  if (!isRecord(value)) return null;
  if (
    value.id !== id ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number'
  ) {
    return null;
  }
  return value as unknown as LegacyCommon;
}

// Migrates version-1 (no number/tag) or version-2 (single tag string) files
// to the current shape. Returns null if the value isn't a valid legacy board.
export function migrateLegacyBoardFile(value: unknown): BoardFile | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.tickets) || !isRecord(value.columns)) return null;
  const legacyTickets = value.tickets as Record<string, unknown>;
  if (!validPlacement(legacyTickets, value.columns as Record<string, unknown>)) return null;
  const columns = value.columns as BoardColumns;

  if (value.version === 1) {
    // v1: assign numbers in createdAt order, no tags.
    const commons: LegacyCommon[] = [];
    for (const [id, ticket] of Object.entries(legacyTickets)) {
      const common = legacyTicketCommon(ticket, id);
      if (!common) return null;
      commons.push(common);
    }
    commons.sort((a, b) => a.createdAt - b.createdAt);
    const tickets: Record<string, Ticket> = {};
    commons.forEach((common, index) => {
      tickets[common.id] = { ...common, number: index + 1, tags: [] };
    });
    return { version: DATA_VERSION, tickets, columns, nextNumber: commons.length + 1 };
  }

  if (value.version === 2) {
    // v2: numbers already exist; single tag string becomes a tags array.
    if (!Number.isInteger(value.nextNumber) || (value.nextNumber as number) < 1) return null;
    const nextNumber = value.nextNumber as number;
    const tickets: Record<string, Ticket> = {};
    const numbers = new Set<number>();
    for (const [id, legacy] of Object.entries(legacyTickets)) {
      const common = legacyTicketCommon(legacy, id);
      if (!common || !isRecord(legacy)) return null;
      const number = legacy.number;
      if (!Number.isInteger(number) || (number as number) < 1) return null;
      if (numbers.has(number as number) || (number as number) >= nextNumber) return null;
      numbers.add(number as number);
      const tag = typeof legacy.tag === 'string' ? legacy.tag.trim() : '';
      tickets[id] = { ...common, number: number as number, tags: tag ? [tag] : [] };
    }
    return { version: DATA_VERSION, tickets, columns, nextNumber };
  }

  return null;
}
