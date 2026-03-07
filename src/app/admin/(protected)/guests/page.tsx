'use client';

import { ChangeEvent, Fragment, useMemo, useState } from 'react';
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
  inviteCode: string;
  qrToken?: string;
  canAddCompanions: boolean;
  maxCompanions: bigint;
  contactEmail?: string;
  contactPhone?: string;
};

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

function safeLower(text: string | undefined): string {
  return (text ?? '').toLowerCase();
}

function parseCompanionsText(text: string): Array<{ name: string; relationship?: string; dietaryNotes?: string }> {
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

  const [headerRow, ...dataRows] = lines;
  const headers = headerRow.map((h) => h.trim());
  const indexOf = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const required = ['firstName', 'lastName', 'inviteCode', 'canAddCompanions', 'maxCompanions'];
  const missing = required.filter((name) => indexOf(name) < 0);
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(', ')}`] };
  }

  const output: ImportDraft[] = [];
  const errors: string[] = [];

  dataRows.forEach((cols, rowIndex) => {
    const rowNo = rowIndex + 2;
    const read = (name: string) => {
      const idx = indexOf(name);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };

    const firstName = read('firstName');
    const lastName = read('lastName');
    const inviteCode = read('inviteCode').toUpperCase();
    const qrToken = read('qrToken') || undefined;
    const canAddRaw = safeLower(read('canAddCompanions'));
    const maxCompanionsRaw = read('maxCompanions');
    const contactEmail = read('contactEmail') || undefined;
    const contactPhone = read('contactPhone') || undefined;

    if (!firstName || !lastName || !inviteCode) {
      errors.push(`Row ${rowNo}: firstName, lastName, and inviteCode are required.`);
      return;
    }

    const canAddCompanions = canAddRaw === 'true' || canAddRaw === '1' || canAddRaw === 'yes';
    if (!canAddCompanions && !(canAddRaw === 'false' || canAddRaw === '0' || canAddRaw === 'no')) {
      errors.push(`Row ${rowNo}: canAddCompanions must be true/false.`);
      return;
    }

    if (!/^\d+$/.test(maxCompanionsRaw)) {
      errors.push(`Row ${rowNo}: maxCompanions must be an integer >= 0.`);
      return;
    }

    output.push({
      firstName,
      lastName,
      inviteCode,
      qrToken,
      canAddCompanions,
      maxCompanions: BigInt(maxCompanionsRaw),
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
  const [onlyNoResponse, setOnlyNoResponse] = useState(false);

  const [editingGuestId, setEditingGuestId] = useState<bigint | null>(null);
  const [draft, setDraft] = useState<GuestDraft | null>(null);

  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<RsvpStatus>('pending');

  const [csvInput, setCsvInput] = useState('');
  const [importNotice, setImportNotice] = useState('');

  const [messageNotice, setMessageNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const isLoading = guestsLoading || responsesLoading || companionsLoading || messagesLoading;

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

      if (onlyNoResponse && guest.rsvpStatus !== 'pending') return false;

      return true;
    });
  }, [
    companionsByGuestId,
    hasCompanionsFilter,
    hasDietaryFilter,
    messageStatusFilter,
    messagesByGuestId,
    onlyNoResponse,
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

  const selectedRows = useMemo(() => {
    const selected = new Set(selectedGuestIds);
    return filteredGuests.filter((guest) => selected.has(guest.id.toString()));
  }, [filteredGuests, selectedGuestIds]);

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

  const saveInlineEdit = () => {
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
      connection.reducers.adminUpdateGuestRsvp({
        guestId: editingGuestId,
        rsvpStatus: draft.rsvpStatus,
        dietaryNotes: draft.dietaryNotes || undefined,
        notes: draft.notes || undefined,
        contactEmail: draft.contactEmail || undefined,
        contactPhone: draft.contactPhone || undefined,
        canAddCompanions: draft.canAddCompanions,
        maxCompanions: BigInt(draft.maxCompanions),
      });

      connection.reducers.adminReplaceGuestCompanions({
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

  const applyBulkStatus = () => {
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
      connection.reducers.adminBulkSetRsvpStatus({
        guestIds: selectedRows.map((g) => g.id),
        rsvpStatus: bulkStatus,
      });
      setMessageNotice(`Updated ${selectedRows.length} guest(s) to ${bulkStatus}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Bulk action failed.');
    }
  };

  const importGuests = () => {
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
      for (const row of parsedImport.rows) {
        connection.reducers.adminUpsertGuest({
          firstName: row.firstName,
          lastName: row.lastName,
          inviteCode: row.inviteCode,
          qrToken: row.qrToken,
          canAddCompanions: row.canAddCompanions,
          maxCompanions: row.maxCompanions,
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

  const regenerateSelectedQr = () => {
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
        connection.reducers.adminRegenerateGuestQrToken({ guestId: guest.id });
      }
      setMessageNotice(`Regenerated QR token(s) for ${selectedRows.length} guest(s).`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to regenerate QR token(s).');
    }
  };

  const downloadSelectedQr = () => {
    if (selectedRows.length === 0) {
      setActionError('Select at least one guest first.');
      return;
    }
    for (const guest of selectedRows) {
      window.open(`/api/admin/qr?token=${encodeURIComponent(guest.qrToken)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const updateMessageStatus = (messageId: bigint, status: MessageStatus) => {
    clearMessages();
    if (!connection) {
      setActionError('Connection is not ready yet.');
      return;
    }
    try {
      connection.reducers.adminSetGuestMessageStatus({ messageId, status });
      setMessageNotice('Message status updated.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update message status.');
    }
  };

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.has(guest.id.toString()));

  return (
    <>
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.65rem' }}>
          <input
            type="checkbox"
            checked={onlyNoResponse}
            onChange={(event) => setOnlyNoResponse(event.target.checked)}
          />
          <span>Only guests with no response yet</span>
        </label>
      </section>

      <section className="card">
        <h2 className="heading-with-icon" style={{ marginBottom: '0.6rem' }}>
          <Icon name="playlist_add_check" className="heading-icon" />
          <span>Bulk Actions and Import</span>
        </h2>
        <div className="cta-row" style={{ justifyContent: 'flex-start' }}>
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

        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
          <label>
            CSV import (firstName,lastName,inviteCode,qrToken,canAddCompanions,maxCompanions,contactEmail,contactPhone)
            <textarea
              rows={6}
              value={csvInput}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCsvInput(event.target.value)}
              placeholder="firstName,lastName,inviteCode,qrToken,canAddCompanions,maxCompanions,contactEmail,contactPhone"
            />
          </label>
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
              <Icon name="upload" className="button-icon" /> Import / Upsert Guests
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        {isLoading ? (
          <p>Loading guest data...</p>
        ) : (
          <>
            <div className="cta-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <p className="small-note" style={{ margin: 0 }}>
                Showing {filteredGuests.length} of {guests.length} guests.
              </p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(event) => toggleSelectAllFiltered(event.target.checked)}
                />
                <span>Select all filtered</span>
              </label>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }} />
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Guest</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Dietary / Notes</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Companions</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Messages</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>QR</th>
                    <th style={{ textAlign: 'left', padding: '0.45rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuests.map((guest) => {
                    const response = responseByGuestId.get(guest.id);
                    const guestCompanions = companionsByGuestId.get(guest.id) ?? [];
                    const guestMessages = messagesByGuestId.get(guest.id) ?? [];
                    const unreadCount = unreadByGuestId.get(guest.id) ?? 0;
                    const isEditing = editingGuestId === guest.id && draft !== null;
                    return (
                      <Fragment key={guest.id.toString()}>
                        <tr>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <input
                              type="checkbox"
                              checked={selectedGuestIds.has(guest.id.toString())}
                              onChange={(event) => toggleSelect(guest.id, event.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <strong>
                              {guest.firstName} {guest.lastName}
                            </strong>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.inviteCode}
                            </p>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.contactPhone || guest.contactEmail || '—'}
                            </p>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <span className="detail-pill">{guest.rsvpStatus}</span>
                            <p className="small-note" style={{ margin: 0 }}>
                              Updated {formatDate(response?.updatedAt ?? guest.updatedAt)}
                            </p>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <p className="small-note" style={{ margin: 0 }}>
                              {response?.dietaryNotes || 'No dietary notes'}
                            </p>
                            <p className="small-note" style={{ margin: 0 }}>
                              {response?.notes || 'No notes'}
                            </p>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guestCompanions.length} / {guest.maxCompanions.toString()}
                            </p>
                            <p className="small-note" style={{ margin: 0 }}>
                              {guest.canAddCompanions ? 'Allowed' : 'Not allowed'}
                            </p>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <p className="small-note" style={{ margin: 0 }}>{guestMessages.length} total</p>
                            <p className="small-note" style={{ margin: 0 }}>{unreadCount} new</p>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <a
                              href={`/api/admin/qr?token=${encodeURIComponent(guest.qrToken)}`}
                              className="button-secondary"
                              style={{ display: 'inline-flex' }}
                            >
                              <Icon name="download" className="button-icon" /> QR
                            </a>
                          </td>
                          <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--line)' }}>
                            <button type="button" className="button-secondary" onClick={() => beginEdit(guest)}>
                              <Icon name="edit" className="button-icon" /> Edit
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              style={{ marginLeft: '0.35rem' }}
                              onClick={() => {
                                clearMessages();
                                if (!connection) {
                                  setActionError('Connection is not ready yet.');
                                  return;
                                }
                                try {
                                  connection.reducers.adminRegenerateGuestQrToken({ guestId: guest.id });
                                  setMessageNotice(`Regenerated QR token for ${guest.firstName} ${guest.lastName}.`);
                                } catch (error) {
                                  setActionError(
                                    error instanceof Error ? error.message : 'Unable to regenerate QR token.'
                                  );
                                }
                              }}
                            >
                              <Icon name="autorenew" className="button-icon" /> New QR
                            </button>
                          </td>
                        </tr>
                        {isEditing ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '0.8rem', borderBottom: '1px solid var(--line)' }}>
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

      {messageNotice ? <p className="small-note">{messageNotice}</p> : null}
      {importNotice ? <p className="small-note">{importNotice}</p> : null}
      {actionError ? <p className="small-note">{actionError}</p> : null}
    </>
  );
}
