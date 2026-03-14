'use client';

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection, tables } from '@/module_bindings';
import { type Companion, type Guest, type GuestMessage, type RsvpResponse } from '@/module_bindings/types';
import { useDebugTable } from '@/lib/use-debug-table';

const RSVP_STATUSES = ['attending', 'declining', 'pending'] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

const MESSAGE_STATUSES = ['new', 'in_progress', 'resolved'] as const;
type MessageStatus = (typeof MESSAGE_STATUSES)[number];

type GuestDraft = {
  rsvpStatus: RsvpStatus;
  dietaryNotes: string;
  notes: string;
  contactEmail: string;
  contactPhone: string;
  canAddCompanions: boolean;
  maxCompanions: string;
  companionsText: string;
};

type ImportDraft = {
  firstName: string;
  lastName: string;
  contactEmail?: string;
  contactPhone?: string;
};

type InvitationWizardDraft = {
  firstName: string;
  lastName: string;
  contactEmail: string;
  contactPhone: string;
  canAddCompanions: boolean;
  maxCompanions: string;
};

type CreatedInvitation = {
  firstName: string;
  lastName: string;
  inviteCode: string;
  qrToken: string;
  contactEmail?: string;
  contactPhone?: string;
  canAddCompanions: boolean;
  maxCompanions: string;
  rsvpUrl: string;
};

type DashboardTab = 'guests' | 'invite' | 'bulk' | 'messages';

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string; icon: string }> = [
  { id: 'guests', label: 'Guest list', icon: 'groups' },
  { id: 'invite', label: 'New invitation', icon: 'person_add' },
  { id: 'bulk', label: 'Bulk and import', icon: 'playlist_add_check' },
  { id: 'messages', label: 'Messages', icon: 'mail' },
];

const DASHBOARD_TAB_SUMMARIES: Record<DashboardTab, string> = {
  guests: 'Search, filter, edit, and export live guest records.',
  invite: 'Create a guest invitation from the dashboard with an auto-generated invite code, QR token, and RSVP link.',
  bulk: 'Run RSVP bulk actions and import batches of guests via CSV.',
  messages: 'Review incoming guest questions and update message statuses.',
};

const IDENTIFIER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INITIAL_INVITATION_DRAFT: InvitationWizardDraft = {
  firstName: '',
  lastName: '',
  contactEmail: '',
  contactPhone: '',
  canAddCompanions: true,
  maxCompanions: '5',
};

const STATUS_ORDER: Record<RsvpStatus, number> = {
  attending: 0,
  declining: 1,
  pending: 2,
};

const WEDDING_INVITATION_DETAILS = {
  couple: 'Samuel & Natasha',
  date: 'Saturday, 15 August 2026',
  time: '10:00 AM',
  venue: 'The Singapore Thomson Road Baptist Church',
  address: '45 Thomson Road, Singapore 307584',
  attire: 'Formal',
  receptionNote: 'Lunch reception to follow in the church hall.',
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

function buildInvitationRecord(input: Omit<CreatedInvitation, 'rsvpUrl'>): CreatedInvitation {
  return {
    ...input,
    rsvpUrl: buildRsvpUrl(input.qrToken),
  };
}

function buildInvitationRecordFromGuest(guest: Guest): CreatedInvitation {
  return buildInvitationRecord({
    firstName: guest.firstName,
    lastName: guest.lastName,
    inviteCode: guest.inviteCode,
    qrToken: guest.qrToken,
    contactEmail: guest.contactEmail ?? undefined,
    contactPhone: guest.contactPhone ?? undefined,
    canAddCompanions: guest.canAddCompanions,
    maxCompanions: guest.maxCompanions.toString(),
  });
}

function buildInvitationMessage(invitation: CreatedInvitation): string {
  const guestName = `${invitation.firstName} ${invitation.lastName}`.trim();
  const companionLine = invitation.canAddCompanions
    ? `Your invitation allows up to ${invitation.maxCompanions} companion(s).`
    : 'This invitation is for you only.';

  return [
    `Dear ${guestName},`,
    '',
    `With joy, we invite you to celebrate the wedding of ${WEDDING_INVITATION_DETAILS.couple}.`,
    '',
    `Date: ${WEDDING_INVITATION_DETAILS.date}`,
    `Time: ${WEDDING_INVITATION_DETAILS.time}`,
    `Venue: ${WEDDING_INVITATION_DETAILS.venue}`,
    `Address: ${WEDDING_INVITATION_DETAILS.address}`,
    `Attire: ${WEDDING_INVITATION_DETAILS.attire}`,
    WEDDING_INVITATION_DETAILS.receptionNote,
    '',
    companionLine,
    `Invite code: ${invitation.inviteCode}`,
    `RSVP link: ${invitation.rsvpUrl}`,
    `QR token: ${invitation.qrToken}`,
    'You can also scan the QR code attached with this message to open your RSVP page directly.',
    '',
    'We look forward to celebrating with you.',
    'Samuel & Natasha',
  ].join('\n');
}

async function fetchInvitationQrBlob(qrToken: string): Promise<Blob> {
  const response = await fetch(`/api/admin/qr?token=${encodeURIComponent(qrToken)}&download=0`, {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Unable to generate the QR code right now.');
  }

  return response.blob();
}

async function copyInvitationQrToClipboard(qrToken: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard copy is not supported in this browser.');
  }

  const qrBlob = await fetchInvitationQrBlob(qrToken);
  await navigator.clipboard.write([new ClipboardItem({ [qrBlob.type || 'image/png']: qrBlob })]);
}

async function copyInvitationBundleToClipboard(invitation: CreatedInvitation, message: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Combined text and image clipboard copy is not supported in this browser.');
  }

  const qrBlob = await fetchInvitationQrBlob(invitation.qrToken);
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([message], { type: 'text/plain' }),
      [qrBlob.type || 'image/png']: qrBlob,
    }),
  ]);
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

function generateQrToken(inviteCode: string, existingQrTokens: Set<string>): string {
  const normalizedInviteCode = inviteCode.trim().toLowerCase();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${normalizedInviteCode}-${createRandomIdentifier(10).toLowerCase()}`;
    if (!existingQrTokens.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique QR token right now.');
}

function isIdentifierConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('already exists') || message.includes('unique') || message.includes('constraint');
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
    ['firstname', 'lastname', 'contactemail', 'email', 'contactphone', 'phone'].includes(header)
  );
  const headers = looksLikeHeader ? normalizedFirstRow : ['firstname', 'lastname', 'contactemail', 'contactphone'];
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
    const contactEmail = read('contactemail', 'email') || undefined;
    const contactPhone = read('contactphone', 'phone') || undefined;

    if (!firstName || !lastName) {
      errors.push(`Row ${rowNo}: firstName and lastName are required.`);
      return;
    }

    output.push({
      firstName,
      lastName,
      contactEmail,
      contactPhone,
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
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;

  const [guests, guestsLoading] = useDebugTable<Guest>('admin.guest', tables.guest);
  const [responses, responsesLoading] = useDebugTable<RsvpResponse>('admin.rsvp_response', tables.rsvp_response);
  const [companions, companionsLoading] = useDebugTable<Companion>('admin.companion', tables.companion);
  const [messages, messagesLoading] = useDebugTable<GuestMessage>('admin.guest_message', tables.guest_message);

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
  const [inviteDraft, setInviteDraft] = useState<InvitationWizardDraft>(INITIAL_INVITATION_DRAFT);
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitation | null>(null);
  const [shareAction, setShareAction] = useState<'text' | 'qr' | 'bundle' | null>(null);
  const isLoading = !db.isActive;

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
        guest.qrToken,
        guest.contactEmail ?? '',
        guest.contactPhone ?? '',
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
      responded: attending + declining,
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
  const existingQrTokens = useMemo(() => new Set(guests.map((guest) => guest.qrToken)), [guests]);
  const invitationMessage = useMemo(
    () => (createdInvitation ? buildInvitationMessage(createdInvitation) : ''),
    [createdInvitation]
  );

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
      contactEmail: guest.contactEmail ?? '',
      contactPhone: guest.contactPhone ?? '',
      canAddCompanions: guest.canAddCompanions,
      maxCompanions: guest.maxCompanions.toString(),
      companionsText: companionsToText(guestCompanions),
    });
  };

  const updateDraft = <K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateInviteDraft = <K extends keyof InvitationWizardDraft>(key: K, value: InvitationWizardDraft[K]) => {
    setInviteDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetInvitationWizard = () => {
    setInviteDraft(INITIAL_INVITATION_DRAFT);
  };

  const validateInvitationDraft = (): string | null => {
    if (!inviteDraft.firstName.trim() || !inviteDraft.lastName.trim()) {
      return 'First name and last name are required.';
    }

    if (!/^\d+$/.test(inviteDraft.maxCompanions)) {
      return 'Max companions must be a whole number 0 or above.';
    }

    return null;
  };

  const saveInlineEdit = async () => {
    clearMessages();
    if (!connection || !draft || editingGuestId === null) {
      setActionError('Connection is not ready yet.');
      return;
    }

    if (!/^\d+$/.test(draft.maxCompanions)) {
      setActionError('Max companions must be a whole number 0 or above.');
      return;
    }

    try {
      await connection.reducers.adminUpdateGuestRsvp({
        guestId: editingGuestId,
        rsvpStatus: draft.rsvpStatus,
        dietaryNotes: draft.dietaryNotes || undefined,
        notes: draft.notes || undefined,
        contactEmail: draft.contactEmail || undefined,
        contactPhone: draft.contactPhone || undefined,
        canAddCompanions: draft.canAddCompanions,
        maxCompanions: BigInt(draft.maxCompanions),
      });

      await connection.reducers.adminReplaceGuestCompanions({
        guestId: editingGuestId,
        companions: parseCompanionsText(draft.companionsText),
      });

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
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }
    if (selectedRows.length === 0) {
      setActionError('Select at least one guest first.');
      return;
    }

    try {
      await connection.reducers.adminBulkSetRsvpStatus({
        guestIds: selectedRows.map((g) => g.id),
        rsvpStatus: bulkStatus,
      });
      setMessageNotice(`Updated ${selectedRows.length} guest(s) to ${bulkStatus}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Bulk action failed.');
    }
  };

  const importGuests = async () => {
    clearMessages();
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }
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
      const qrTokens = new Set(existingQrTokens);

      for (const row of parsedImport.rows) {
        const inviteCode = generateInviteCode(row.firstName, row.lastName, inviteCodes);
        inviteCodes.add(inviteCode);

        const qrToken = generateQrToken(inviteCode, qrTokens);
        qrTokens.add(qrToken);

        await connection.reducers.adminUpsertGuest({
          firstName: row.firstName,
          lastName: row.lastName,
          inviteCode,
          qrToken,
          canAddCompanions: false,
          maxCompanions: 0n,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
        });
      }
      setImportNotice(`Imported ${parsedImport.rows.length} row(s).`);
      setCsvInput('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Guest import failed.');
    }
  };

  const createInvitation = async () => {
    clearMessages();
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }

    const validationError = validateInvitationDraft();
    if (validationError) {
      setActionError(validationError);
      return;
    }

    const firstName = inviteDraft.firstName.trim();
    const lastName = inviteDraft.lastName.trim();
    const contactEmail = inviteDraft.contactEmail.trim() || undefined;
    const contactPhone = inviteDraft.contactPhone.trim() || undefined;
    const canAddCompanions = inviteDraft.canAddCompanions;
    const maxCompanions = canAddCompanions ? BigInt(inviteDraft.maxCompanions || '0') : 0n;

    const inviteCodes = new Set(existingInviteCodes);
    const qrTokens = new Set(existingQrTokens);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = generateInviteCode(firstName, lastName, inviteCodes);
      inviteCodes.add(inviteCode);

      const qrToken = generateQrToken(inviteCode, qrTokens);
      qrTokens.add(qrToken);

      try {
        await connection.reducers.adminUpsertGuest({
          firstName,
          lastName,
          inviteCode,
          qrToken,
          canAddCompanions,
          maxCompanions,
          contactEmail,
          contactPhone,
        });

        setCreatedInvitation(buildInvitationRecord({
          firstName,
          lastName,
          inviteCode,
          qrToken,
          contactEmail,
          contactPhone,
          canAddCompanions,
          maxCompanions: maxCompanions.toString(),
        }));
        setMessageNotice(`Created invitation for ${firstName} ${lastName}.`);
        resetInvitationWizard();
        return;
      } catch (error) {
        if (attempt < 4 && isIdentifierConflictError(error)) {
          continue;
        }
        setActionError(error instanceof Error ? error.message : 'Unable to create the invitation.');
        return;
      }
    }

    setActionError('Unable to generate a unique invite code and QR token. Please try again.');
  };

  const regenerateSelectedQr = async () => {
    clearMessages();
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }
    if (selectedRows.length === 0) {
      setActionError('Select at least one guest first.');
      return;
    }

    try {
      for (const guest of selectedRows) {
        await connection.reducers.adminRegenerateGuestQrToken({ guestId: guest.id });
      }
      setMessageNotice(`Regenerated QR token(s) for ${selectedRows.length} guest(s).`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to regenerate QR token(s).');
    }
  };

  const downloadSelectedQr = () => {
    clearMessages();
    if (selectedRows.length === 0) {
      setActionError('Select at least one guest first.');
      return;
    }
    for (const guest of selectedRows) {
      window.open(`/api/admin/qr?token=${encodeURIComponent(guest.qrToken)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const copyInviteLink = async (guest: Pick<Guest, 'firstName' | 'lastName' | 'qrToken'>) => {
    clearMessages();
    try {
      await copyTextToClipboard(buildRsvpUrl(guest.qrToken));
      setMessageNotice(`Invite link copied for ${guest.firstName} ${guest.lastName}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to copy invite link.');
    }
  };

  const openInvitationSharePanel = (guest: Guest) => {
    clearMessages();
    setCreatedInvitation(buildInvitationRecordFromGuest(guest));
    setActiveTab('invite');
    setMessageNotice(`Prepared invitation message for ${guest.firstName} ${guest.lastName}.`);
  };

  const copyInvitationText = async () => {
    if (!createdInvitation) {
      return;
    }

    clearMessages();
    setShareAction('text');
    try {
      await copyTextToClipboard(invitationMessage);
      setMessageNotice('Invitation text copied. Paste it into Telegram or WhatsApp.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to copy invitation text.');
    } finally {
      setShareAction(null);
    }
  };

  const copyInvitationQr = async () => {
    if (!createdInvitation) {
      return;
    }

    clearMessages();
    setShareAction('qr');
    try {
      await copyInvitationQrToClipboard(createdInvitation.qrToken);
      setMessageNotice('QR image copied. You can paste it into Telegram or WhatsApp.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to copy the QR image.');
    } finally {
      setShareAction(null);
    }
  };

  const copyInvitationBundle = async () => {
    if (!createdInvitation) {
      return;
    }

    clearMessages();
    setShareAction('bundle');
    try {
      await copyInvitationBundleToClipboard(createdInvitation, invitationMessage);
      setMessageNotice('Invitation text and QR copied together.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to copy the invitation package.');
    } finally {
      setShareAction(null);
    }
  };

  const updateMessageStatus = async (messageId: bigint, status: MessageStatus) => {
    clearMessages();
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }
    try {
      await connection.reducers.adminSetGuestMessageStatus({ messageId, status });
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
        <p>Manage RSVPs, guest records, QR access, and incoming guest messages.</p>
      </section>

      <section className="card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '0.9rem',
            textAlign: 'center',
          }}
        >
          <StatCell label="Invited" value={stats.invited} />
          <StatCell label="Responded" value={stats.responded} />
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
              placeholder="Name, invite code, QR, phone, email"
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

      {activeTab === 'invite' ? (
      <section className="card">
        <h2 className="heading-with-icon" style={{ marginBottom: '0.2rem' }}>
          <Icon name="person_add" className="heading-icon" />
          <span>Add Guest</span>
        </h2>
        <p className="small-note" style={{ marginTop: 0 }}>
          Create a guest invitation directly from the admin dashboard. Invite code, QR token, and RSVP link are generated automatically. New guests default to a maximum of 5 companions.
        </p>

        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <label>
            First name
            <input
              value={inviteDraft.firstName}
              onChange={(event) => updateInviteDraft('firstName', event.target.value)}
              placeholder="Natasha"
            />
          </label>
          <label>
            Last name
            <input
              value={inviteDraft.lastName}
              onChange={(event) => updateInviteDraft('lastName', event.target.value)}
              placeholder="Wong"
            />
          </label>
          <label>
            Contact email
            <input
              value={inviteDraft.contactEmail}
              onChange={(event) => updateInviteDraft('contactEmail', event.target.value)}
              placeholder="guest@example.com"
            />
          </label>
          <label>
            Contact phone
            <input
              value={inviteDraft.contactPhone}
              onChange={(event) => updateInviteDraft('contactPhone', event.target.value)}
              placeholder="+65 ..."
            />
          </label>
        </div>

        <div
          style={{
            marginTop: '0.9rem',
            border: '1px solid var(--line)',
            borderRadius: '0.65rem',
            padding: '0.95rem 1rem',
            background: 'rgba(255, 255, 255, 0.52)',
          }}
        >
          <p className="detail-inline">System generated access</p>
          <p className="small-note" style={{ marginTop: '0.25rem' }}>
            The dashboard will create a unique invite code and QR token on submit. Companion access is enabled by default with a limit of {inviteDraft.maxCompanions}.
          </p>
        </div>

        <div className="cta-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="button-primary" onClick={createInvitation}>
            <Icon name="qr_code_2" className="button-icon" /> Submit
          </button>
        </div>

        {createdInvitation ? (
        <div
          style={{
            marginTop: '0.6rem',
            border: '1px solid color-mix(in srgb, var(--accent) 44%, var(--line))',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(155deg, rgba(255,255,255,0.96), rgba(244,233,216,0.95))',
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(220px, 320px)',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <h3 style={{ margin: 0 }}>Invitation ready</h3>
            <p className="small-note">
              {createdInvitation.firstName} {createdInvitation.lastName} can now unlock the RSVP flow with the generated token or QR code below.
            </p>
            <div style={{ display: 'grid', gap: '0.55rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div>
                <p className="eyebrow">Invite Code</p>
                <p className="detail-strong">{createdInvitation.inviteCode}</p>
              </div>
              <div>
                <p className="eyebrow">QR Token</p>
                <p className="detail-strong" style={{ wordBreak: 'break-word' }}>{createdInvitation.qrToken}</p>
              </div>
              <div>
                <p className="eyebrow">Contact</p>
                <p className="small-note">
                  {createdInvitation.contactPhone || createdInvitation.contactEmail || 'No contact saved'}
                </p>
              </div>
              <div>
                <p className="eyebrow">Companions</p>
                <p className="small-note">
                  {createdInvitation.canAddCompanions ? `Allowed up to ${createdInvitation.maxCompanions}` : 'No companions allowed'}
                </p>
              </div>
            </div>
            <label>
              RSVP link
              <input value={createdInvitation.rsvpUrl} readOnly />
            </label>
            <div className="cta-row" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="button-secondary" onClick={() => void copyInvitationText()}>
                <Icon name="content_copy" className="button-icon" />
                {shareAction === 'text' ? 'Copying text...' : 'Copy text'}
              </button>
              <button type="button" className="button-secondary" onClick={() => void copyInvitationQr()}>
                <Icon name="image" className="button-icon" />
                {shareAction === 'qr' ? 'Copying QR...' : 'Copy QR'}
              </button>
              <button type="button" className="button-secondary" onClick={() => void copyInvitationBundle()}>
                <Icon name="forward_to_inbox" className="button-icon" />
                {shareAction === 'bundle' ? 'Copying package...' : 'Copy text + QR'}
              </button>
              <button type="button" className="button-secondary" onClick={() => void copyInviteLink(createdInvitation)}>
                <Icon name="link" className="button-icon" /> Copy invite link
              </button>
              <a href={`/api/admin/qr?token=${encodeURIComponent(createdInvitation.qrToken)}`} className="button-secondary">
                <Icon name="download" className="button-icon" /> Download QR
              </a>
              <a href={createdInvitation.rsvpUrl} target="_blank" rel="noreferrer" className="button-secondary">
                <Icon name="open_in_new" className="button-icon" /> Open RSVP page
              </a>
            </div>
            <label>
              Invitation message
              <textarea
                rows={14}
                value={invitationMessage}
                readOnly
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              />
            </label>
            <p className="small-note">
              Copy the message text, the QR image, or both together before pasting into Telegram or WhatsApp. If the
              browser blocks the combined copy, use the separate copy buttons instead.
            </p>
          </div>

          <div
            style={{
              justifySelf: 'center',
              width: '100%',
              maxWidth: '280px',
              display: 'grid',
              gap: '0.55rem',
              justifyItems: 'center',
            }}
          >
            <img
              src={`/api/admin/qr?token=${encodeURIComponent(createdInvitation.qrToken)}&download=0`}
              alt={`QR code for ${createdInvitation.firstName} ${createdInvitation.lastName}`}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '0.75rem',
                border: '1px solid var(--line)',
                background: '#fff',
                padding: '0.65rem',
              }}
            />
            <p className="small-note" style={{ textAlign: 'center' }}>
              QR generated automatically from the invitation token. Scanning it opens the live <code>/rsvp/[token]</code> flow.
            </p>
          </div>
        </div>
        ) : null}
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
            CSV import (firstName,lastName,contact email (optional),contact phone (optional))
            <textarea
              rows={6}
              value={csvInput}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCsvInput(event.target.value)}
              placeholder={'firstName,lastName,contact email (optional),contact phone (optional)\nJohn,Doe,john@example.com,+65 9123 4567'}
            />
          </label>
          <p className="small-note" style={{ margin: 0 }}>
            Each row creates one guest. You can include just `firstName,lastName`, or also add optional email and phone columns. Invite codes and QR tokens are generated automatically, and imported guests default to no companions.
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
              <button type="button" className="button-secondary" onClick={regenerateSelectedQr}>
                <Icon name="qr_code_2" className="button-icon" /> Regenerate QR for selected
              </button>
              <button type="button" className="button-secondary" onClick={downloadSelectedQr}>
                <Icon name="download" className="button-icon" /> Download selected QR
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
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.contactPhone || guest.contactEmail || '—'}
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
                              {guestCompanions.length} / {guest.maxCompanions.toString()}
                            </p>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.canAddCompanions ? 'Allowed' : 'Not allowed'}
                            </p>
                          </td>
                          <td>
                            <p className="small-note" style={{ margin: 0 }}>{guestMessages.length} total</p>
                            <p className="small-note" style={{ margin: 0 }}>{unreadCount} new</p>
                          </td>
                          <td className="admin-guest-actions-cell">
                            <div className="admin-guest-action-group">
                              <a
                                href={`/api/admin/qr?token=${encodeURIComponent(guest.qrToken)}`}
                                className="button-secondary admin-guest-action-button"
                                aria-label={`Download QR for ${guestName}`}
                                title={`Download QR for ${guestName}`}
                              >
                                <Icon name="download" className="button-icon" />
                              </a>
                              <button
                                type="button"
                                className="button-secondary admin-guest-action-button"
                                onClick={() => void copyInviteLink(guest)}
                                aria-label={`Copy invite link for ${guestName}`}
                                title={`Copy invite link for ${guestName}`}
                              >
                                <Icon name="content_copy" className="button-icon" />
                              </button>
                              <button
                                type="button"
                                className="button-secondary admin-guest-action-button"
                                onClick={() => openInvitationSharePanel(guest)}
                                aria-label={`Open invite message for ${guestName}`}
                                title={`Open invite message for ${guestName}`}
                              >
                                <Icon name="mail" className="button-icon" />
                              </button>
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
                                  if (!connection) {
                                    setActionError('Connection is not ready yet.');
                                    return;
                                  }
                                  try {
                                    await connection.reducers.adminRegenerateGuestQrToken({ guestId: guest.id });
                                    setMessageNotice(`Regenerated QR token for ${guestName}.`);
                                  } catch (error) {
                                    setActionError(
                                      error instanceof Error ? error.message : 'Unable to regenerate QR token.'
                                    );
                                  }
                                }}
                                aria-label={`Regenerate QR token for ${guestName}`}
                                title={`Regenerate QR token for ${guestName}`}
                              >
                                <Icon name="autorenew" className="button-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isEditing ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '0.8rem', borderBottom: '1px solid var(--line)' }}>
                              <div style={{ display: 'grid', gap: '0.65rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                                <label>
                                  Email
                                  <input
                                    value={draft.contactEmail}
                                    onChange={(event) => updateDraft('contactEmail', event.target.value)}
                                  />
                                </label>
                                <label>
                                  Phone
                                  <input
                                    value={draft.contactPhone}
                                    onChange={(event) => updateDraft('contactPhone', event.target.value)}
                                  />
                                </label>
                                <label>
                                  Max companions
                                  <input
                                    value={draft.maxCompanions}
                                    onChange={(event) => updateDraft('maxCompanions', event.target.value)}
                                  />
                                </label>
                              </div>
                              <label
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  marginTop: '0.65rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.canAddCompanions}
                                  onChange={(event) => updateDraft('canAddCompanions', event.target.checked)}
                                />
                                <span>Can add companions</span>
                              </label>
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
