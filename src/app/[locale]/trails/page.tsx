import { getLocale, getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function TrailsPage() {
  const t = await getTranslations('trails');
  const locale = await getLocale();

  const [settings, sections] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.infoSection.findMany({
      where: { type: 'trails' },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const visibleSections = sections.filter(
    (s) => (locale === 'he' ? s.titleHe || s.bodyHe : s.titleEn || s.bodyEn) || s.imageUrl
  );

  if (!settings?.trailsPublished && visibleSections.length === 0) {
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

        {visibleSections.length === 0 ? (
          <p className="text-ink-light">{t('empty')}</p>
        ) : (
          <div className="space-y-6">
            {visibleSections.map((s) => {
              const title = locale === 'he' ? s.titleHe : s.titleEn;
              const body = locale === 'he' ? s.bodyHe : s.bodyEn;
              return (
                <section key={s.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-6 shadow-sm">
                  {title && <h2 className="mb-2 text-xl font-bold">{title}</h2>}
                  {body && <p className="whitespace-pre-line leading-relaxed text-ink">{body}</p>}
                  {s.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt={title} className="mt-4 w-full rounded-xl border border-ink/10" />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
