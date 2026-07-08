import { getTranslations } from 'next-intl/server';

// Admin-only CSV downloads. These are plain links to the /api/export/* routes,
// which each enforce the ADMIN role server-side.
export default async function ExportButtons() {
  const t = await getTranslations('manage');

  const links = [
    { href: '/api/export/competitors', label: t('exportCompetitors') },
    { href: '/api/export/heats', label: t('exportHeats') },
    { href: '/api/export/results', label: t('exportResults') },
  ];

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
      <h2 className="mb-3 font-semibold">{t('exportTitle')}</h2>
      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            download
            className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5"
          >
            ↓ {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
