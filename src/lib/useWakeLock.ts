'use client';

import { useEffect } from 'react';

// Minimal shape of the Screen Wake Lock API we rely on. Declared locally so the
// hook compiles regardless of the TS DOM lib version, and accessed defensively
// because iOS Safari < 16.4 and some in-app browsers don't support it at all.
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

/**
 * Keep the device screen awake while `enabled` is true.
 *
 * Timekeepers stand at a station for long stretches without touching the
 * device, so the OS would normally dim and lock the screen — forcing them to
 * unlock (and re-enter a password) before they can stamp the next athlete. This
 * holds a screen wake lock for as long as timekeeping is active.
 *
 * The browser silently releases the lock whenever the tab is hidden (screen
 * off, app switched, another tab), so we re-acquire it on every return to
 * visibility. No-ops gracefully where the API is unavailable.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined') return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      // Only meaningful while the page is actually visible; a hidden tab can't
      // hold a screen lock and the request would reject.
      if (cancelled || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await wakeLock.request('screen');
        // If the OS drops the lock on its own, forget the stale sentinel so the
        // next visibility change re-acquires cleanly.
        sentinel.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Permission denied, low battery, or unsupported — nothing to recover.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
