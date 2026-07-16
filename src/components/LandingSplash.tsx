'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// How long the intro GIF is shown before it fades out. The animation is one
// ~2.6s loop, so we hold it for a single play-through, then fade to reveal the
// page underneath.
const PLAY_MS = 2600;
const FADE_MS = 500;

// Module-scoped so the splash plays once per full page load (i.e. each time a
// visitor *enters* the app) rather than replaying on every client-side
// navigation back to the home page within the same session.
let playedThisLoad = false;

/**
 * Full-screen intro overlay shown on top of the home page. The page renders
 * underneath immediately; this simply covers it with the brand GIF for one
 * loop and then fades away. Clicking (or the Skip button) dismisses early, and
 * visitors who prefer reduced motion never see it.
 */
export default function LandingSplash() {
  const t = useTranslations('home');
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), FADE_MS);
  }, []);

  // Decide (once per page load) whether to show the splash at all. No cleanup
  // here on purpose: under React StrictMode's double-invoke this effect just
  // no-ops the second time via the module guard.
  useEffect(() => {
    if (playedThisLoad) return;
    playedThisLoad = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setShow(true);
  }, []);

  // Auto-dismiss timer, owned by the `show` state (not the once-guard) so it is
  // always (re)scheduled whenever the overlay is actually up — robust to the
  // StrictMode mount/cleanup/mount cycle that would otherwise clear it.
  useEffect(() => {
    if (!show || leaving) return;
    const timer = window.setTimeout(dismiss, PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [show, leaving, dismiss]);

  // Lock background scroll while the overlay is up.
  useEffect(() => {
    if (!show) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      role="presentation"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-cream transition-opacity ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing.gif"
        alt={t('splashAlt')}
        className="max-h-full max-w-full object-contain"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute bottom-6 right-6 rounded-full border border-ink/15 bg-surface/70 px-4 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-ink/10"
      >
        {t('splashSkip')} →
      </button>
    </div>
  );
}
