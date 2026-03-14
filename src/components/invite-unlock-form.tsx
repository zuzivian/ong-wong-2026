'use client';

import { FormEvent, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/icon';
import {
  normalizeInviteCode,
  UNLOCKED_INVITE_CODE_STORAGE_KEY,
} from '@/lib/unlock-client';

type UnlockResponse = {
  ok?: boolean;
  error?: string;
};

type InviteUnlockFormProps = {
  destination: string;
  className?: string;
  inputLabel?: string;
  placeholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  onSuccess?: () => void;
};

export default function InviteUnlockForm({
  destination,
  className,
  inputLabel = 'Invite code from your invitation (letters and numbers only)',
  placeholder = 'e.g. SW26148',
  submitLabel = 'Unlock Invitation',
  submittingLabel = 'Opening...',
  onSuccess,
}: InviteUnlockFormProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      setError('Please enter your invite code.');
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
        setError(payload?.error ?? 'We could not open your invitation just now. Please try again.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(UNLOCKED_INVITE_CODE_STORAGE_KEY, normalizedCode);
      }

      onSuccess?.();
      if (typeof window !== 'undefined' && pathname === destination) {
        window.location.assign(destination);
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError('We could not open your invitation right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={`form-stack${className ? ` ${className}` : ''}`} onSubmit={onSubmit}>
      <label>
        {inputLabel}
        <input
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder={placeholder}
          autoComplete="one-time-code"
        />
      </label>
      <p className="small-note">Please enter your code without dashes.</p>
      {error ? (
        <p className="small-note" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cta-row">
        <button
          type="submit"
          className="button-primary"
          disabled={isSubmitting}
        >
          <Icon name="lock_open_right" className="button-icon" />
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
