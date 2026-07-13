'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { syncHeatsWithRoster } from '@/actions/event';

/**
 * Runs once when the admin opens the Heats tab: reconciles the scheduled heats
 * with any group/competitor edits made on the Registration tab. It only forces a
 * client refresh when the reconcile actually changed something, so a revisit with
 * nothing new is a no-op (no flicker). Mount-guarded so it fires a single time
 * per entry into the tab.
 */
export default function SyncHeatsWithRoster() {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    syncHeatsWithRoster().then((r) => {
      if (r?.changed) router.refresh();
    });
  }, [router]);

  return null;
}
