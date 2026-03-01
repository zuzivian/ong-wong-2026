'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/icon';
import {
  normalizeInviteCode,
  UNLOCKED_INVITE_CODE_STORAGE_KEY,
} from '@/lib/unlock-client';

type UnlockResponse = {
  ok?: boolean;
  error?: string;
};

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/')) {
    return '/rsvp';
  }

  if (nextPath === '/unlock' || nextPath.startsWith('/unlock/')) {
    return '/rsvp';
  }

  return nextPath;
}

export default function UnlockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const destination = useMemo(() => sanitizeNextPath(nextPath), [nextPath]);

  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      setError('Invite code is required.');
      return;
    }
    const normalizedCode = normalizeInviteCode(trimmedCode);

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: normalizedCode }),
      });
      const payload = (await response.json().catch(() => null)) as UnlockResponse | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Unable to unlock. Please try again.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(UNLOCKED_INVITE_CODE_STORAGE_KEY, normalizedCode);
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError('Unable to unlock right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rsvp-shell">
      <h1 className="heading-with-icon">
        <Icon name="lock_open" className="heading-icon" />
        <span>Unlock Invitation</span>
      </h1>
      <p>Enter your personal invite code to access RSVP and full event details.</p>
      <form className="form-stack" onSubmit={onSubmit}>
        <label>
          Personal invite code
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="e.g. SW26-148"
            autoComplete="one-time-code"
            required
          />
        </label>
        {error ? <p className="small-note">{error}</p> : null}
        <div className="cta-row">
          <button type="submit" className="button-primary" disabled={isSubmitting}>
            <Icon name="lock_open_right" className="button-icon" />
            {isSubmitting ? 'Unlocking...' : 'Unlock Site'}
          </button>
        </div>
      </form>
    </section>
  );
}
