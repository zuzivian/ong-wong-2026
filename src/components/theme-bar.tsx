'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ReadonlyURLSearchParams, usePathname, useSearchParams } from 'next/navigation';
import { DesignVariant, getVariantMeta, listVariants, parseVariant } from '@/lib/design-variant';

function buildHref(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  variant: DesignVariant
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('v', variant);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function ThemeBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeVariant = parseVariant(searchParams.get('v') ?? undefined);

  useEffect(() => {
    const classes = ['live-theme-heirloom', 'live-theme-botanical', 'live-theme-chapel'];
    for (const klass of classes) {
      document.body.classList.remove(klass);
    }
    document.body.classList.add(`live-theme-${activeVariant}`);
    return () => {
      for (const klass of classes) {
        document.body.classList.remove(klass);
      }
    };
  }, [activeVariant]);

  return (
    <aside className="theme-bar" aria-label="Live color scheme selector">
      <p>Live Theme</p>
      <div className="theme-bar-buttons">
        {listVariants().map((variant) => {
          const meta = getVariantMeta(variant);
          const isActive = activeVariant === variant;
          return (
            <Link
              key={variant}
              href={buildHref(pathname, searchParams, variant)}
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
            >
              {meta.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
