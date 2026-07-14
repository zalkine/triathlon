'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createInfoSection, updateInfoSection, deleteInfoSection, moveInfoSection } from '@/actions/info';
import { setCompetitionInfoPublished } from '@/actions/event';

type Section = {
  id: string;
  titleEn: string;
  titleHe: string;
  bodyEn: string;
  bodyHe: string;
  imageUrl: string | null;
};

const inputCls = 'w-full rounded-lg border border-ink/20 px-3 py-2 text-sm focus:border-ink focus:outline-none';

function SectionCard({ section, count, index }: { section: Section; count: number; index: number }) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(section.imageUrl ?? '');
  const [uploadMsg, setUploadMsg] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    fd.set('imageUrl', imageUrl);
    startTransition(async () => {
      await updateInfoSection(section.id, fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  };

  const remove = () => {
    if (!window.confirm(t('infoConfirmDelete'))) return;
    startTransition(async () => {
      await deleteInfoSection(section.id, new FormData());
      router.refresh();
    });
  };

  const move = (dir: 'up' | 'down') => {
    startTransition(async () => {
      await moveInfoSection(section.id, dir);
      router.refresh();
    });
  };

  const upload = async (file: File) => {
    setUploadMsg(t('infoUploading'));
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setImageUrl(data.url);
      setUploadMsg(t('infoUploadDone'));
    } else if (res.status === 501) {
      setUploadMsg(t('infoUploadNotConfigured'));
    } else {
      const data = await res.json().catch(() => ({}));
      setUploadMsg(data.detail ? `${t('infoUploadFailed')} (${data.detail})` : t('infoUploadFailed'));
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(e.currentTarget);
      }}
      className="space-y-3 rounded-2xl border border-ink/10 bg-white/70 p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-light">#{index + 1}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={index === 0 || isPending} onClick={() => move('up')} className="rounded border border-ink/15 px-2 py-0.5 text-xs disabled:opacity-40">
            ↑
          </button>
          <button type="button" disabled={index === count - 1 || isPending} onClick={() => move('down')} className="rounded border border-ink/15 px-2 py-0.5 text-xs disabled:opacity-40">
            ↓
          </button>
          <button type="button" onClick={remove} className="text-xs text-run-dark underline">
            {t('deleteRegistrant')}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          {t('infoTitleHe')}
          <input name="titleHe" defaultValue={section.titleHe} dir="rtl" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          {t('infoTitleEn')}
          <input name="titleEn" defaultValue={section.titleEn} dir="ltr" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          {t('infoBodyHe')}
          <textarea name="bodyHe" defaultValue={section.bodyHe} dir="rtl" rows={4} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          {t('infoBodyEn')}
          <textarea name="bodyEn" defaultValue={section.bodyEn} dir="ltr" rows={4} className={inputCls} />
        </label>
      </div>

      {/* Image / map */}
      <div className="space-y-2 rounded-xl border border-ink/10 bg-cream/40 p-3">
        <p className="text-xs font-semibold text-ink-light">{t('infoImage')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="text-xs"
          />
          {uploadMsg && <span className="text-xs text-ink-light">{uploadMsg}</span>}
        </div>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder={t('infoImageUrlPlaceholder')}
          dir="ltr"
          className={inputCls}
        />
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="max-h-48 rounded-lg border border-ink/10" />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-60">
          {t('save')}
        </button>
        {saved && <span className="text-xs text-swim-dark">✓ {t('save')}</span>}
      </div>
    </form>
  );
}

export default function CompetitionInfoEditor({
  published,
  sections,
}: {
  published: boolean;
  sections: Section[];
}) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const addSection = () => {
    startTransition(async () => {
      await createInfoSection('competitionInfo');
      router.refresh();
    });
  };

  const togglePublish = () => {
    startTransition(async () => {
      await setCompetitionInfoPublished('en', !published);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-light">{t('competitionInfoHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePublish}
            disabled={isPending}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-60 ${
              published
                ? 'bg-swim text-cream'
                : 'border border-swim-dark bg-transparent text-swim-dark hover:bg-swim/5'
            }`}
          >
            {published ? '✓ Published' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={addSection}
            disabled={isPending}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-60"
          >
            {t('infoAddSection')}
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-ink-light">{t('infoNone')}</p>
      ) : (
        sections.map((s, i) => <SectionCard key={s.id} section={s} index={i} count={sections.length} />)
      )}
    </div>
  );
}
