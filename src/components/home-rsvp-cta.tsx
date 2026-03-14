'use client';

import Link from 'next/link';
import Icon from '@/components/icon';
import { normalizeInviteCode } from '@/lib/unlock-client';

type HomeRsvpCtaProps = {
  inviteCode?: string;
  initialSubmitted?: boolean;
  hideWhenSubmitted?: boolean;
  className?: string;
};

export default function HomeRsvpCta({
  inviteCode = '',
  initialSubmitted = false,
  hideWhenSubmitted = false,
  className = 'button-primary',
}: HomeRsvpCtaProps) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  const rsvpHref = normalizedInviteCode ? `/rsvp/${normalizedInviteCode}` : '/rsvp';

  if (hideWhenSubmitted && initialSubmitted) {
    return null;
  }

  if (initialSubmitted) {
    return (
      <Link href="/dashboard" className={className}>
        <Icon name="how_to_reg" className="button-icon" /> Your RSVP
      </Link>
    );
  }

  return (
    <Link href={rsvpHref} className={className}>
      <Icon name="how_to_reg" className="button-icon" /> Submit RSVP
    </Link>
  );
}
