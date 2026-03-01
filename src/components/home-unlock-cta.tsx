'use client';

import { useState } from 'react';
import Icon from '@/components/icon';
import InviteUnlockForm from '@/components/invite-unlock-form';

export default function HomeUnlockCta() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`home-unlock-stack${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="button-primary home-unlock-trigger"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        disabled={isOpen}
      >
        <Icon name="lock_open" className="button-icon" />
        Enter Invite Code
      </button>
      {isOpen ? (
        <div className="home-inline-unlock">
          <InviteUnlockForm destination="/" onSuccess={() => setIsOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
