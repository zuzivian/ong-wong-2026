'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/icon';
import { UNLOCKED_INVITE_CODE_STORAGE_KEY } from '@/lib/unlock-client';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const onLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await fetch('/api/unlock', { method: 'DELETE' });
    } catch {
      // Continue to clear local state and route to home page.
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(UNLOCKED_INVITE_CODE_STORAGE_KEY);
      }

      router.replace('/');
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      className="button-secondary nav-logout-button"
      onClick={() => void onLogout()}
      disabled={isLoggingOut}
    >
      <Icon name="logout" className="nav-icon" />
      <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
    </button>
  );
}
