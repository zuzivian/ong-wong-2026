'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/icon';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Incorrect PIN.');
        return;
      }
      router.replace('/admin/guests');
      router.refresh();
    } catch {
      setError('Unable to authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-head card admin-login-shell">
      <h1 className="heading-with-icon">
        <Icon name="admin_panel_settings" className="heading-icon" />
        <span>Admin Access</span>
      </h1>
      <p>Enter the admin PIN to continue.</p>
      <form className="form-stack" onSubmit={onSubmit}>
        <label>
          Admin PIN
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="small-note" role="alert">
            {error}
          </p>
        ) : null}
        <div className="cta-row">
          <button type="submit" className="button-primary" disabled={isSubmitting}>
            <Icon name="lock_open" className="button-icon" />
            {isSubmitting ? 'Verifying...' : 'Enter'}
          </button>
        </div>
      </form>
    </section>
  );
}
