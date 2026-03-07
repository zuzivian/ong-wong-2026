'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Timestamp } from 'spacetimedb';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection, tables } from '@/module_bindings';
import { useDebugTable } from '@/lib/use-debug-table';

function timestampToInputValue(value: Timestamp): string {
  const date = value.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function AdminCutoffPage() {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const [configRows, isLoading] = useDebugTable<any>('admin.config', tables.config);
  const config = useMemo(() => configRows.find((row) => row.id === 1n), [configRows]);

  // TODO: Migrate RSVP cutoff management to the admin dashboard (post-MVP).
  // Default pre-fills 31 May 2026 23:59 SGT (UTC+8) as the suggested deadline.
  const [value, setValue] = useState('2026-05-31T23:59');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const currentCutoff = config?.globalRsvpCutoffAt;

  const onApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('');
    setError('');

    if (!connection) {
      setError('Connection is not ready yet.');
      return;
    }

    if (!value) {
      setError('Choose a date and time first.');
      return;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      setError('Invalid date/time value.');
      return;
    }

    try {
      connection.reducers.setGlobalRsvpCutoff({ cutoffAt: Timestamp.fromDate(date) });
      setStatus('Global RSVP cutoff saved.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save cutoff.');
    }
  };

  const onClear = () => {
    setStatus('');
    setError('');

    if (!connection) {
      setError('Connection is not ready yet.');
      return;
    }

    try {
      connection.reducers.setGlobalRsvpCutoff({ cutoffAt: undefined });
      setValue('');
      setStatus('Global RSVP cutoff cleared.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to clear cutoff.');
    }
  };

  return (
    <>
      <section className="page-head">
        <h1 className="heading-with-icon">
          <Icon name="admin_panel_settings" className="heading-icon" />
          <span>Admin: RSVP Cutoff</span>
        </h1>
        <p>Set or clear the global RSVP edit deadline.</p>
      </section>

      <section className="card">
        {isLoading ? <p>Loading current configuration...</p> : null}
        {!isLoading ? (
          <>
            <p>
              Current cutoff:{' '}
              {currentCutoff ? currentCutoff.toDate().toLocaleString() : 'Not set (RSVP remains editable).'}
            </p>
            {currentCutoff ? (
              <p className="small-note">Input hint: {timestampToInputValue(currentCutoff)}</p>
            ) : null}
            <form className="form-stack" onSubmit={onApply}>
              <label>
                New cutoff date/time
                <input
                  type="datetime-local"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
              <div className="cta-row">
                <button type="submit" className="button-primary">
                  <Icon name="save" className="button-icon" /> Save Cutoff
                </button>
                <button type="button" className="button-secondary" onClick={onClear}>
                  <Icon name="delete" className="button-icon" /> Clear Cutoff
                </button>
              </div>
            </form>
            {status ? <p className="small-note">{status}</p> : null}
            {error ? <p className="small-note">{error}</p> : null}
          </>
        ) : null}
      </section>
    </>
  );
}
