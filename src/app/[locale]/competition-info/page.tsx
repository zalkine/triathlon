import { getLocale, getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CompetitionInfoPage() {
  const t = await getTranslations('competitionInfo');
  const locale = await getLocale();

  const [settings, sections, contacts] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.infoSection.findMany({
      where: { type: 'competitionInfo' },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.contact.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const visibleSections = sections.filter(
    (s) => (locale === 'he' ? s.titleHe || s.bodyHe : s.titleEn || s.bodyEn) || s.imageUrl
  );

  if (!settings?.competitionInfoPublished && visibleSections.length === 0 && contacts.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-10">
          <p className="text-ink-light">{t('notPublished')}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-10">
        <header>
          <h1 className="text-3xl font-black">{t('title')}</h1>
          <p className="text-ink-light">{t('subtitle')}</p>
        </header>

        <div className="space-y-6">
          {visibleSections.map((s) => {
            const title = locale === 'he' ? s.titleHe : s.titleEn;
            const body = locale === 'he' ? s.bodyHe : s.bodyEn;
            return (
              <section key={s.id} className="rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm">
                {title && <h2 className="mb-2 text-xl font-bold">{title}</h2>}
                {body && <p className="whitespace-pre-line leading-relaxed text-ink">{body}</p>}
                {s.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={title} className="mt-4 w-full rounded-xl border border-ink/10" />
                )}
              </section>
            );
          })}

          {contacts.length > 0 && (
            <section className="rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">📞 {t('contactsTitle')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-xs text-ink-light">
                      <th className="px-3 py-2 text-start font-medium">{t('roleCol')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('nameCol')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('phoneCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b border-ink/5 last:border-0">
                        <td className="px-3 py-2 font-medium">{c.role}</td>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">
                          {c.phone ? <a href={`tel:${c.phone}`} className="underline">{c.phone}</a> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
