'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type SiteMotionProps = {
  children: React.ReactNode;
};

const REVEAL_SELECTOR = [
  'main section',
  'main .card',
  'main .link-panel',
  'main .rsvp-shell',
  'main .page-head',
  '.theme-bar',
].join(', ');

export default function SiteMotion({ children }: SiteMotionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const motionKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

    for (const [index, node] of nodes.entries()) {
      node.setAttribute('data-reveal', '');
      node.style.setProperty('--reveal-delay', `${Math.min(index * 45, 420)}ms`);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );

    for (const node of nodes) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [motionKey]);

  return (
    <div key={motionKey} className="route-stage motion-scope">
      {children}
    </div>
  );
}
