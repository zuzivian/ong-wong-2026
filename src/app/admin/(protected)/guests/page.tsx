'use client';

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/icon';
import { type Companion, type Guest, type GuestMessage, type RsvpResponse } from '@/module_bindings/types';

const RSVP_STATUSES = ['attending', 'declining', 'pending'] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

const MESSAGE_STATUSES = ['new', 'in_progress', 'resolved'] as const;
type MessageStatus = (typeof MESSAGE_STATUSES)[number];

type GuestDraft = {
  rsvpStatus: RsvpStatus;
  dietaryNotes: string;
  notes: string;
  companionsText: string;
};

type ImportDraft = {
  firstName: string;
  lastName: string;
};

type DashboardTab = 'guests' | 'bulk' | 'messages';

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string; icon: string }> = [
  { id: 'guests', label: 'Guest list', icon: 'groups' },
  { id: 'bulk', label: 'Add Guests', icon: 'playlist_add_check' },
  { id: 'messages', label: 'Messages', icon: 'mail' },
];

const DASHBOARD_TAB_SUMMARIES: Record<DashboardTab, string> = {
  guests: 'Search, filter, edit, and export live guest records.',
  bulk: 'Run RSVP bulk actions and import batches of guests via CSV.',
  messages: 'Review incoming guest questions and update message statuses.',
};

const IDENTIFIER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const STATUS_ORDER: Record<RsvpStatus, number> = {
  attending: 0,
  declining: 1,
  pending: 2,
};

function formatDate(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('en-SG');
}

function buildRsvpUrl(token: string): string {
  const baseUrl = typeof window === 'undefined' ? '' : window.location.origin;
  return `${baseUrl}/rsvp/${encodeURIComponent(token)}`;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable in this environment.');
  }

  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, input.value.length);

  const copied = document.execCommand('copy');
  document.body.removeChild(input);

  if (!copied) {
    throw new Error('Clipboard copy failed.');
  }
}

async function runAdminAction(body: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/admin/spacetimedb', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Admin action failed.');
  }
}

type SerializedTimestamp = {
  microsSinceUnixEpoch?: string;
  __timestamp_micros_since_unix_epoch__?: string;
};

type SerializedGuest = Omit<Guest, 'id' | 'updatedAt'> & {
  id: string;
  updatedAt: SerializedTimestamp;
};

type SerializedRsvpResponse = Omit<RsvpResponse, 'id' | 'guestId' | 'updatedAt'> & {
  id: string;
  guestId: string;
  updatedAt: SerializedTimestamp;
};

type SerializedCompanion = Omit<Companion, 'id' | 'guestId' | 'updatedAt'> & {
  id: string;
  guestId: string;
  updatedAt: SerializedTimestamp;
};

type SerializedGuestMessage = Omit<GuestMessage, 'id' | 'guestId' | 'createdAt'> & {
  id: string;
  guestId: string;
  createdAt: SerializedTimestamp;
};

type AdminSnapshotPayload = {
  guests: SerializedGuest[];
  responses: SerializedRsvpResponse[];
  companions: SerializedCompanion[];
  messages: SerializedGuestMessage[];
};

function parseTimestamp(timestamp: SerializedTimestamp): any {
  const rawMicrosSinceUnixEpoch =
    timestamp.microsSinceUnixEpoch ?? timestamp.__timestamp_micros_since_unix_epoch__;

  if (rawMicrosSinceUnixEpoch === undefined) {
    throw new Error('Admin snapshot is missing timestamp data.');
  }

  const microsSinceUnixEpoch = BigInt(rawMicrosSinceUnixEpoch);
  return {
    __timestamp_micros_since_unix_epoch__: microsSinceUnixEpoch,
    microsSinceUnixEpoch,
    toDate() {
      return new Date(Number(microsSinceUnixEpoch / 1000n));
    },
    toMillis() {
      return Number(microsSinceUnixEpoch / 1000n);
    },
    toISOString() {
      return new Date(Number(microsSinceUnixEpoch / 1000n)).toISOString();
    },
    since(other: { microsSinceUnixEpoch: bigint }) {
      return microsSinceUnixEpoch - other.microsSinceUnixEpoch;
    },
  };
}

function parseGuest(row: SerializedGuest): Guest {
  return {
    ...row,
    id: BigInt(row.id),
    updatedAt: parseTimestamp(row.updatedAt),
  };
}

function parseResponse(row: SerializedRsvpResponse): RsvpResponse {
  return {
    ...row,
    id: BigInt(row.id),
    guestId: BigInt(row.guestId),
    updatedAt: parseTimestamp(row.updatedAt),
  };
}

function parseCompanion(row: SerializedCompanion): Companion {
  return {
    ...row,
    id: BigInt(row.id),
    guestId: BigInt(row.guestId),
    updatedAt: parseTimestamp(row.updatedAt),
  };
}

function parseGuestMessage(row: SerializedGuestMessage): GuestMessage {
  return {
    ...row,
    id: BigInt(row.id),
    guestId: BigInt(row.guestId),
    createdAt: parseTimestamp(row.createdAt),
  };
}

async function fetchAdminSnapshot(): Promise<{
  guests: Guest[];
  responses: RsvpResponse[];
  companions: Companion[];
  messages: GuestMessage[];
}> {
  const response = await fetch('/api/admin/spacetimedb', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; snapshot?: AdminSnapshotPayload }
    | null;

  if (!response.ok || !payload?.snapshot) {
    throw new Error(payload?.error || 'Unable to load admin dashboard data.');
  }

  return {
    guests: payload.snapshot.guests.map(parseGuest),
    responses: payload.snapshot.responses.map(parseResponse),
    companions: payload.snapshot.companions.map(parseCompanion),
    messages: payload.snapshot.messages.map(parseGuestMessage),
  };
}

function normalizeCodeFragment(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length > 0 ? normalized : 'X';
}

function createRandomIdentifier(length: number): string {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error('Secure identifier generation is unavailable in this browser.');
  }

  const values = new Uint32Array(length);
  cryptoObject.getRandomValues(values);
  return Array.from(values, (value) => IDENTIFIER_ALPHABET[value % IDENTIFIER_ALPHABET.length]).join('');
}

function generateInviteCode(firstName: string, lastName: string, existingInviteCodes: Set<string>): string {
  const firstFragment = normalizeCodeFragment(firstName).slice(0, 2).padEnd(2, 'X');
  const lastFragment = normalizeCodeFragment(lastName).slice(0, 2).padEnd(2, 'X');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${firstFragment}${lastFragment}${createRandomIdentifier(6)}`;
    if (!existingInviteCodes.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique invite code right now.');
}

function parseCompanionsText(text: string): Array<{ name: string; relationship: string | undefined; dietaryNotes: string | undefined }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      return {
        name: parts[0] ?? '',
        relationship: parts[1] || undefined,
        dietaryNotes: parts[2] || undefined,
      };
    })
    .filter((row) => row.name.length > 0);
}

function companionsToText(companions: Companion[]): string {
  return companions
    .map((c) => [c.name, c.relationship ?? '', c.dietaryNotes ?? ''].join(' | ').replace(/\s+\|\s+\|\s*$/, ''))
    .join('\n');
}

function parseCsvLines(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (ch === '"') {
      const next = csv[i + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csv[i + 1] === '\n') {
        i += 1;
      }
      row.push(cell.trim());
      const nonEmpty = row.some((entry) => entry.length > 0);
      if (nonEmpty) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    const nonEmpty = row.some((entry) => entry.length > 0);
    if (nonEmpty) {
      rows.push(row);
    }
  }

  return rows;
}

function parseImportCsv(csv: string): { rows: ImportDraft[]; errors: string[] } {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) {
    return { rows: [], errors: ['CSV is empty.'] };
  }

  const normalizeImportHeader = (header: string) =>
    header
      .trim()
      .toLowerCase()
      .replace(/\(optional\)/g, '')
      .replace(/[^a-z0-9]+/g, '');
  const [firstRow, ...remainingRows] = lines;
  const normalizedFirstRow = firstRow.map(normalizeImportHeader);
  const looksLikeHeader = normalizedFirstRow.some((header) =>
    ['firstname', 'lastname'].includes(header)
  );
  const headers = looksLikeHeader ? normalizedFirstRow : ['firstname', 'lastname'];
  const dataRows = looksLikeHeader ? remainingRows : lines;
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));

  const required = ['firstname', 'lastname'];
  const missing = required.filter((name) => indexOf(name) < 0);
  if (missing.length > 0) {
    return { rows: [], errors: ['Missing required column(s): firstName, lastName'] };
  }

  const output: ImportDraft[] = [];
  const errors: string[] = [];

  dataRows.forEach((cols, rowIndex) => {
    const rowNo = rowIndex + 2;
    const read = (...names: string[]) => {
      const idx = indexOf(...names);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };

    const firstName = read('firstname');
    const lastName = read('lastname');

    if (!firstName || !lastName) {
      errors.push(`Row ${rowNo}: firstName and lastName are required.`);
      return;
    }

    output.push({
      firstName,
      lastName,
    });
  });

  return { rows: output, errors };
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem', justifyItems: 'center' }}>
      <span style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, lineHeight: 1 }}>{value}</span>
      <span className="eyebrow" style={{ fontSize: '0.73rem' }}>{label}</span>
    </div>
  );
}

export default function AdminGuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [responses, setResponses] = useState<RsvpResponse[]>([]);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RsvpStatus>('all');
  const [hasDietaryFilter, setHasDietaryFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [hasCompanionsFilter, setHasCompanionsFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [messageStatusFilter, setMessageStatusFilter] = useState<'all' | MessageStatus | 'none'>('all');

  const [editingGuestId, setEditingGuestId] = useState<bigint | null>(null);
  const [draft, setDraft] = useState<GuestDraft | null>(null);

  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<RsvpStatus>('pending');

  const [csvInput, setCsvInput] = useState('');
  const [importNotice, setImportNotice] = useState('');

  const [messageNotice, setMessageNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('guests');

  const refreshAdminSnapshot = async () => {
    const snapshot = await fetchAdminSnapshot();
    setGuests(snapshot.guests);
    setResponses(snapshot.responses);
    setCompanions(snapshot.companions);
    setMessages(snapshot.messages);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchAdminSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setGuests(snapshot.guests);
        setResponses(snapshot.responses);
        setCompanions(snapshot.companions);
        setMessages(snapshot.messages);
      })
      .catch((error) => {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : 'Unable to load admin dashboard data.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const responseByGuestId = useMemo(() => {
    const map = new Map<bigint, RsvpResponse>();
    for (const row of responses) map.set(row.guestId, row);
    return map;
  }, [responses]);

  const companionsByGuestId = useMemo(() => {
    const map = new Map<bigint, Companion[]>();
    for (const row of companions) {
      const list = map.get(row.guestId) ?? [];
      list.push(row);
      map.set(row.guestId, list);
    }
    return map;
  }, [companions]);

  const messagesByGuestId = useMemo(() => {
    const map = new Map<bigint, GuestMessage[]>();
    for (const row of messages) {
      const list = map.get(row.guestId) ?? [];
      list.push(row);
      map.set(row.guestId, list);
    }
    return map;
  }, [messages]);

  const unreadByGuestId = useMemo(() => {
    const map = new Map<bigint, number>();
    for (const row of messages) {
      if (row.status === 'new') {
        map.set(row.guestId, (map.get(row.guestId) ?? 0) + 1);
      }
    }
    return map;
  }, [messages]);

  const sortedGuests = useMemo(() => {
    return [...guests].sort((a, b) => {
      const order = STATUS_ORDER[a.rsvpStatus as RsvpStatus] - STATUS_ORDER[b.rsvpStatus as RsvpStatus];
      if (order !== 0) return order;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sortedGuests.filter((guest) => {
      const guestResponse = responseByGuestId.get(guest.id);
      const guestCompanions = companionsByGuestId.get(guest.id) ?? [];
      const guestMessages = messagesByGuestId.get(guest.id) ?? [];

      const searchable = [
        `${guest.firstName} ${guest.lastName}`,
        guest.inviteCode,
      ]
        .join(' ')
        .toLowerCase();

      if (needle && !searchable.includes(needle)) return false;
      if (statusFilter !== 'all' && guest.rsvpStatus !== statusFilter) return false;

      const hasDietary = Boolean(guestResponse?.dietaryNotes) || guestCompanions.some((c) => Boolean(c.dietaryNotes));
      if (hasDietaryFilter === 'yes' && !hasDietary) return false;
      if (hasDietaryFilter === 'no' && hasDietary) return false;

      const hasCompanions = guestCompanions.length > 0;
      if (hasCompanionsFilter === 'yes' && !hasCompanions) return false;
      if (hasCompanionsFilter === 'no' && hasCompanions) return false;

      if (messageStatusFilter !== 'all') {
        if (messageStatusFilter === 'none') {
          if (guestMessages.length > 0) return false;
        } else if (!guestMessages.some((m) => m.status === messageStatusFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [
    companionsByGuestId,
    hasCompanionsFilter,
    hasDietaryFilter,
    messageStatusFilter,
    messagesByGuestId,
    responseByGuestId,
    search,
    sortedGuests,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    let attending = 0;
    let declining = 0;
    let pending = 0;
    let companionCount = 0;
    let dietaryCount = 0;

    for (const guest of guests) {
      if (guest.rsvpStatus === 'attending') attending += 1;
      else if (guest.rsvpStatus === 'declining') declining += 1;
      else pending += 1;

      const guestCompanions = companionsByGuestId.get(guest.id) ?? [];
      if (guest.rsvpStatus === 'attending') {
        companionCount += guestCompanions.length;
      }

      const response = responseByGuestId.get(guest.id);
      if (response?.dietaryNotes || guestCompanions.some((c) => c.dietaryNotes)) {
        dietaryCount += 1;
      }
    }

    return {
      invited: guests.length,
      attending,
      declining,
      pending,
      headcount: attending + companionCount,
      dietaryCount,
      companionCount,
    };
  }, [companionsByGuestId, guests, responseByGuestId]);

  const messageStats = useMemo(() => {
    let newCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    for (const message of messages) {
      if (message.status === 'new') newCount += 1;
      else if (message.status === 'in_progress') inProgressCount += 1;
      else if (message.status === 'resolved') resolvedCount += 1;
    }
    return { total: messages.length, newCount, inProgressCount, resolvedCount };
  }, [messages]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
    );
  }, [messages]);

  const parsedImport = useMemo(() => parseImportCsv(csvInput), [csvInput]);
  const existingInviteCodes = useMemo(() => new Set(guests.map((guest) => guest.inviteCode)), [guests]);

  const selectedRows = useMemo(() => {
    const selected = new Set(selectedGuestIds);
    return filteredGuests.filter((guest) => selected.has(guest.id.toString()));
  }, [filteredGuests, selectedGuestIds]);
  const allFilteredSelected = filteredGuests.length > 0 && selectedRows.length === filteredGuests.length;
  const partiallyFilteredSelected = selectedRows.length > 0 && selectedRows.length < filteredGuests.length;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallyFilteredSelected;
    }
  }, [partiallyFilteredSelected]);

  const clearMessages = () => {
    setActionError('');
    setMessageNotice('');
    setImportNotice('');
  };

  const beginEdit = (guest: Guest) => {
    const response = responseByGuestId.get(guest.id);
    const guestCompanions = companionsByGuestId.get(guest.id) ?? [];
    setEditingGuestId(guest.id);
    setDraft({
      rsvpStatus: (guest.rsvpStatus as RsvpStatus) ?? 'pending',
      dietaryNotes: response?.dietaryNotes ?? '',
      notes: response?.notes ?? '',
      companionsText: companionsToText(guestCompanions),
    });
  };

  const updateDraft = <K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveInlineEdit = async () => {
    clearMessages();
    if (!draft || editingGuestId === null) {
      setActionError('Guest details are not ready yet.');
      return;
    }

    try {
      await runAdminAction({
        action: 'updateGuestRsvp',
        guestId: editingGuestId.toString(),
        rsvpStatus: draft.rsvpStatus,
        dietaryNotes: draft.dietaryNotes || undefined,
        notes: draft.notes || undefined,
      });

      await runAdminAction({
        action: 'replaceGuestCompanions',
        guestId: editingGuestId.toString(),
        companions: parseCompanionsText(draft.companionsText),
      });
      await refreshAdminSnapshot();

      setMessageNotice('Guest details saved.');
      setEditingGuestId(null);
      setDraft(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save guest changes.');
    }
  };

  const toggleSelect = (guestId: bigint, checked: boolean) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      const key = guestId.toString();
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      for (const guest of filteredGuests) {
        const key = guest.id.toString();
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const applyBulkStatus = async () => {
    clearMessages();
    if (selectedRows.length === 0) {
      setActionError('Select at least one guest first.');
      return;
    }

    try {
      await runAdminAction({
        action: 'bulkSetRsvpStatus',
        guestIds: selectedRows.map((g) => g.id.toString()),
        rsvpStatus: bulkStatus,
      });
      await refreshAdminSnapshot();
      setMessageNotice(`Updated ${selectedRows.length} guest(s) to ${bulkStatus}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Bulk action failed.');
    }
  };

  const importGuests = async () => {
    clearMessages();
    if (parsedImport.errors.length > 0) {
      setActionError('Fix CSV errors before importing.');
      return;
    }
    if (parsedImport.rows.length === 0) {
      setActionError('No valid rows to import.');
      return;
    }

    try {
      const inviteCodes = new Set(existingInviteCodes);

      for (const row of parsedImport.rows) {
        const inviteCode = generateInviteCode(row.firstName, row.lastName, inviteCodes);
        inviteCodes.add(inviteCode);

        await runAdminAction({
          action: 'upsertGuest',
          firstName: row.firstName,
          lastName: row.lastName,
          inviteCode,
        });
      }
      await refreshAdminSnapshot();
      setImportNotice(`Imported ${parsedImport.rows.length} row(s).`);
      setCsvInput('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Guest import failed.');
    }
  };

  const deleteGuest = async (guest: Guest) => {
    clearMessages();

    const guestName = `${guest.firstName} ${guest.lastName}`.trim();
    const confirmed = window.confirm(
      `Remove ${guestName} from the guest list? This also deletes their RSVP, companions, messages, and active guest sessions.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await runAdminAction({
        action: 'deleteGuest',
        guestId: guest.id.toString(),
      });
      await refreshAdminSnapshot();

      setSelectedGuestIds((prev) => {
        const next = new Set(prev);
        next.delete(guest.id.toString());
        return next;
      });
      if (editingGuestId === guest.id) {
        setEditingGuestId(null);
        setDraft(null);
      }
      setMessageNotice(`Removed ${guestName} from the guest list.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to remove the guest.');
    }
  };

  const updateMessageStatus = async (messageId: bigint, status: MessageStatus) => {
    clearMessages();
    try {
      await runAdminAction({
        action: 'setGuestMessageStatus',
        messageId: messageId.toString(),
        status,
      });
      await refreshAdminSnapshot();
      setMessageNotice('Message status updated.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update message status.');
    }
  };

  return (
    <div className="dashboard-page admin-dashboard-page">
      <section className="page-head">
        <h1 className="heading-with-icon">
          <Icon name="groups" className="heading-icon" />
          <span>Guest Operations Dashboard</span>
        </h1>
        <p>Manage RSVPs, guest records, and incoming guest messages.</p>
      </section>

      <section className="card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '0.9rem',
            textAlign: 'center',
          }}
        >
          <StatCell label="Invited" value={stats.invited} />
          <StatCell label="Attending" value={stats.attending} />
          <StatCell label="Declining" value={stats.declining} />
          <StatCell label="Pending" value={stats.pending} />
          <StatCell label="Headcount" value={stats.headcount} />
          <StatCell label="Dietary Cases" value={stats.dietaryCount} />
          <StatCell label="Companions" value={stats.companionCount} />
        </div>
      </section>

      <section className="card">
        <div className="cta-row" style={{ marginTop: 0 }} role="tablist" aria-label="Guest dashboard tabs">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'button-primary' : 'button-secondary'}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} className="button-icon" /> {tab.label}
            </button>
          ))}
        </div>
        <p className="small-note">{DASHBOARD_TAB_SUMMARIES[activeTab]}</p>
      </section>

      {activeTab === 'guests' ? (
      <section className="card">
        <h2 className="heading-with-icon" style={{ marginBottom: '0.6rem' }}>
          <Icon name="filter_alt" className="heading-icon" />
          <span>Search and Filters</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: '0.75rem' }}>
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, invite code"
            />
          </label>
          <label>
            RSVP Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | RsvpStatus)}>
              <option value="all">All</option>
              <option value="attending">Attending</option>
              <option value="declining">Declining</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label>
            Dietary
            <select value={hasDietaryFilter} onChange={(event) => setHasDietaryFilter(event.target.value as 'all' | 'yes' | 'no')}>
              <option value="all">All</option>
              <option value="yes">Has dietary notes</option>
              <option value="no">No dietary notes</option>
            </select>
          </label>
          <label>
            Companions
            <select
              value={hasCompanionsFilter}
              onChange={(event) => setHasCompanionsFilter(event.target.value as 'all' | 'yes' | 'no')}
            >
              <option value="all">All</option>
              <option value="yes">Has companions</option>
              <option value="no">No companions</option>
            </select>
          </label>
          <label>
            Message Status
            <select
              value={messageStatusFilter}
              onChange={(event) => setMessageStatusFilter(event.target.value as 'all' | MessageStatus | 'none')}
            >
              <option value="all">All</option>
              <option value="new">Has new</option>
              <option value="in_progress">Has in progress</option>
              <option value="resolved">Has resolved</option>
              <option value="none">No messages</option>
            </select>
          </label>
        </div>
      </section>
      ) : null}

      {activeTab === 'bulk' ? (
      <section className="card">
        <h2 className="heading-with-icon" style={{ marginBottom: '0.6rem' }}>
          <Icon name="playlist_add_check" className="heading-icon" />
          <span>Guest Import</span>
        </h2>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
          <label>
            CSV import (firstName,lastName)
            <textarea
              rows={6}
              value={csvInput}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCsvInput(event.target.value)}
              placeholder={'Jane,Doe\nJohn,Doe'}
            />
          </label>
          <p className="small-note" style={{ margin: 0 }}>
            Each row creates one guest. Invite codes are generated automatically, and all guests can invite up to 5 companions.
          </p>
          {parsedImport.errors.length > 0 ? (
            <ul className="small-note" style={{ margin: 0 }}>
              {parsedImport.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <p className="small-note">Preview: {parsedImport.rows.length} valid row(s) ready to import.</p>
          )}
          <div className="cta-row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="button-secondary" onClick={importGuests}>
              <Icon name="upload" className="button-icon" /> Import Guests
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {activeTab === 'guests' ? (
      <section className="card">
        {isLoading ? (
          <p>Loading guest data...</p>
        ) : (
          <>
            <div className="cta-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <p className="small-note" style={{ margin: 0 }}>
                Showing {filteredGuests.length} of {guests.length} guests.
              </p>
            </div>

            <div className="cta-row" style={{ justifyContent: 'flex-start', marginBottom: '0.9rem' }}>
              <label>
                Bulk RSVP status
                <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as RsvpStatus)}>
                  <option value="attending">Attending</option>
                  <option value="declining">Declining</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <button type="button" className="button-secondary" onClick={applyBulkStatus}>
                <Icon name="done_all" className="button-icon" /> Apply to selected ({selectedRows.length})
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="admin-guest-table">
                <thead>
                  <tr>
                    <th>
                      <label
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                        title={allFilteredSelected ? 'Clear all visible guests' : 'Select all visible guests'}
                      >
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={(event) => toggleSelectAllFiltered(event.target.checked)}
                          aria-label={allFilteredSelected ? 'Clear all visible guests' : 'Select all visible guests'}
                        />
                        <span className="small-note" style={{ margin: 0 }}>
                          All
                        </span>
                      </label>
                    </th>
                    <th>Guest</th>
                    <th>Status</th>
                    <th>Dietary / Notes</th>
                    <th>Companions</th>
                    <th>Messages</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuests.map((guest) => {
                    const response = responseByGuestId.get(guest.id);
                    const guestCompanions = companionsByGuestId.get(guest.id) ?? [];
                    const guestMessages = messagesByGuestId.get(guest.id) ?? [];
                    const unreadCount = unreadByGuestId.get(guest.id) ?? 0;
                    const isEditing = editingGuestId === guest.id && draft !== null;
                    const guestName = `${guest.firstName} ${guest.lastName}`.trim();
                    return (
                      <Fragment key={guest.id.toString()}>
                        <tr>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedGuestIds.has(guest.id.toString())}
                              onChange={(event) => toggleSelect(guest.id, event.target.checked)}
                            />
                          </td>
                          <td>
                            <strong>{guestName}</strong>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.inviteCode}
                            </p>
                          </td>
                          <td>
                            <span className="detail-pill">{guest.rsvpStatus}</span>
                            <p className="small-note" style={{ margin: 0 }}>
                              Updated {formatDate(response?.updatedAt ?? guest.updatedAt)}
                            </p>
                          </td>
                          <td>
                            <p className="small-note" style={{ margin: 0 }}>
                              {response?.dietaryNotes || 'No dietary notes'}
                            </p>
                            <p className="small-note" style={{ margin: 0 }}>
                              {response?.notes || 'No notes'}
                            </p>
                          </td>
                          <td>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guestCompanions.length} / 5
                            </p>
                          </td>
                          <td>
                            <p className="small-note" style={{ margin: 0 }}>{guestMessages.length} total</p>
                            <p className="small-note" style={{ margin: 0 }}>{unreadCount} new</p>
                          </td>
                          <td className="admin-guest-actions-cell">
                            <div className="admin-guest-action-group">
                              <button
                                type="button"
                                className="button-secondary admin-guest-action-button"
                                onClick={() => beginEdit(guest)}
                                aria-label={`Edit ${guestName}`}
                                title={`Edit ${guestName}`}
                              >
                                <Icon name="edit" className="button-icon" />
                              </button>
                              <button
                                type="button"
                                className="button-secondary admin-guest-action-button"
                                onClick={async () => {
                                  clearMessages();
                                  try {
                                    await copyTextToClipboard(buildRsvpUrl(guest.inviteCode));
                                    setMessageNotice(`Invite link copied for ${guestName}.`);
                                  } catch (error) {
                                    setActionError(error instanceof Error ? error.message : 'Unable to copy invite link.');
                                  }
                                }}
                                aria-label={`Copy invite link for ${guestName}`}
                                title={`Copy invite link for ${guestName}`}
                              >
                                <Icon name="content_copy" className="button-icon" />
                              </button>
                              <button
                                type="button"
                                className="button-secondary admin-guest-action-button"
                                onClick={() => void deleteGuest(guest)}
                                aria-label={`Remove ${guestName}`}
                                title={`Remove ${guestName}`}
                              >
                                <Icon name="delete" className="button-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isEditing ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '0.8rem', borderBottom: '1px solid var(--line)' }}>
                              <div style={{ display: 'grid', gap: '0.65rem' }}>
                                <label>
                                  RSVP Status
                                  <select
                                    value={draft.rsvpStatus}
                                    onChange={(event) => updateDraft('rsvpStatus', event.target.value as RsvpStatus)}
                                  >
                                    <option value="attending">Attending</option>
                                    <option value="declining">Declining</option>
                                    <option value="pending">Pending</option>
                                  </select>
                                </label>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '0.65rem' }}>
                                <label>
                                  Dietary notes
                                  <textarea
                                    rows={3}
                                    value={draft.dietaryNotes}
                                    onChange={(event) => updateDraft('dietaryNotes', event.target.value)}
                                  />
                                </label>
                                <label>
                                  RSVP notes
                                  <textarea
                                    rows={3}
                                    value={draft.notes}
                                    onChange={(event) => updateDraft('notes', event.target.value)}
                                  />
                                </label>
                              </div>
                              <label style={{ marginTop: '0.65rem' }}>
                                Companion list (one per line: name | relationship | dietary)
                                <textarea
                                  rows={4}
                                  value={draft.companionsText}
                                  onChange={(event) => updateDraft('companionsText', event.target.value)}
                                />
                              </label>
                              <div className="cta-row" style={{ justifyContent: 'flex-start', marginTop: '0.65rem' }}>
                                <button type="button" className="button-primary" onClick={saveInlineEdit}>
                                  <Icon name="save" className="button-icon" /> Save
                                </button>
                                <button
                                  type="button"
                                  className="button-secondary"
                                  onClick={() => {
                                    setEditingGuestId(null);
                                    setDraft(null);
                                  }}
                                >
                                  <Icon name="close" className="button-icon" /> Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      ) : null}

      {activeTab === 'messages' ? (
      <section className="card">
        <h2 className="heading-with-icon" style={{ marginBottom: '0.6rem' }}>
          <Icon name="mail" className="heading-icon" />
          <span>Message Inbox</span>
        </h2>
        <p className="small-note" style={{ marginTop: 0 }}>
          Total {messageStats.total} · New {messageStats.newCount} · In progress {messageStats.inProgressCount} · Resolved {messageStats.resolvedCount}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.45rem' }}>Guest</th>
                <th style={{ textAlign: 'left', padding: '0.45rem' }}>Message</th>
                <th style={{ textAlign: 'left', padding: '0.45rem' }}>Created</th>
                <th style={{ textAlign: 'left', padding: '0.45rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedMessages.map((message) => {
                const guest = guests.find((g) => g.id === message.guestId);
                return (
                  <tr key={message.id.toString()}>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                      {guest ? `${guest.firstName} ${guest.lastName}` : `Guest #${message.guestId.toString()}`}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>{message.message}</td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                      {formatDateTime(message.createdAt)}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                      <select
                        value={message.status}
                        onChange={(event) => updateMessageStatus(message.id, event.target.value as MessageStatus)}
                      >
                        <option value="new">new</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {sortedMessages.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>
                    <span className="small-note">No messages yet.</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {messageNotice ? <p className="small-note">{messageNotice}</p> : null}
      {importNotice ? <p className="small-note">{importNotice}</p> : null}
      {actionError ? <p className="small-note">{actionError}</p> : null}
    </div>
  );
}
