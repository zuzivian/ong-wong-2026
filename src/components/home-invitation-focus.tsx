'use client';

import { useEffect } from 'react';

type HomeInvitationFocusProps = {
  targetId: string;
};

const SPOTLIGHT_CLASS = 'invitation-card-spotlight';
const MIN_SCROLL_DURATION_MS = 2250;
const MAX_SCROLL_DURATION_MS = 4200;
const SCROLL_PIXELS_PER_MS = 0.4533333333333333;

function easeSteady(value: number): number {
  const sineEase = 0.5 - 0.5 * Math.cos(Math.PI * value);
  const cubicEase = value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

  // Bias toward a gentler ease-in so the scroll doesn't lurch on the first frames.
  return sineEase * 0.35 + cubicEase * 0.65;
}

function getCenteredScrollTop(target: HTMLElement): number {
  const rect = target.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const centeredOffset = (window.innerHeight - rect.height) / 2;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

  return Math.max(0, Math.min(maxScroll, absoluteTop - centeredOffset));
}

export default function HomeInvitationFocus({ targetId }: HomeInvitationFocusProps) {
  useEffect(() => {
    const section = document.getElementById(targetId);
    if (!section) {
      return;
    }

    const card = section.querySelector<HTMLElement>('.invitation-card');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId: number | null = null;
    let spotlightTimeoutId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      if (prefersReducedMotion) {
        section.scrollIntoView({ behavior: 'auto', block: 'center' });
      } else {
        const startTop = window.scrollY;
        const targetTop = getCenteredScrollTop(section);
        const distance = targetTop - startTop;
        const absDistance = Math.abs(distance);

        if (absDistance < 6) {
          window.scrollTo(0, targetTop);
          return;
        }

        const scrollDurationMs = Math.min(
          MAX_SCROLL_DURATION_MS,
          Math.max(MIN_SCROLL_DURATION_MS, absDistance / SCROLL_PIXELS_PER_MS)
        );
        const startTime = performance.now();

        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / scrollDurationMs, 1);
          const easedProgress = easeSteady(progress);

          window.scrollTo(0, startTop + distance * easedProgress);
          if (progress < 1) {
            frameId = window.requestAnimationFrame(tick);
          }
        };

        frameId = window.requestAnimationFrame(tick);
      }

      if (card) {
        card.classList.add(SPOTLIGHT_CLASS);
        spotlightTimeoutId = window.setTimeout(() => {
          card.classList.remove(SPOTLIGHT_CLASS);
        }, 2600);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeoutId);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (spotlightTimeoutId !== null) {
        window.clearTimeout(spotlightTimeoutId);
      }
      if (card) {
        card.classList.remove(SPOTLIGHT_CLASS);
      }
    };
  }, [targetId]);

  return null;
}
