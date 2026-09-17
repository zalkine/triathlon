'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { addRaceEntry } from '@/actions/entries';
import { withCapacityConfirm } from '@/lib/confirmCapacity';

// Admin heat page: add a competitor/team to this heat by name. Shares the
// pool-capacity guard with every other way of placing someone, so adding a ninth
// swimmer here asks the same question the start line would.
export default function AddEntryForm({ heatId }: { heatId: string }) {
  const t = useTranslations('manage');
  const tc = useTranslations('common');
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    start(async () => {
      const result = await withCapacityConfirm(
        (force) => addRaceEntry(heatId, trimmed, force),
        (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
      );
      // Keep what they typed if they backed out of the over-capacity prompt.
      if (result && 'ok' in result) setName('');
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('entryName')}
        className="rounded-lg border border-ink/20 px-4 py-2"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-50"
      >
        {t('addEntry')}
      </button>
    </form>
  );
}
