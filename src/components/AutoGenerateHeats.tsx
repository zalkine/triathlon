'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { generateSchedule } from '@/actions/event';

/**
 * Fires the preliminary schedule generation automatically when the admin opens
 * the dashboard and there are registrants not yet placed in a heat. Generation
 * is additive (it only ever appends newly-registered people to heats and never
 * moves anyone the admin has already arranged), so this is safe to run on load.
 * Runs at most once per mount to avoid loops when some people can't be placed
 * (e.g. available team members still waiting for a group).
 */
export default function AutoGenerateHeats({ locale, placeableCount }: { locale: string; placeableCount: number }) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (placeableCount > 0 && !fired.current) {
      fired.current = true;
      generateSchedule(locale).then(() => router.refresh());
    }
  }, [locale, placeableCount, router]);

  return null;
}
