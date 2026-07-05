import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { createHeat } from '@/actions/heats';

export default async function NewHeatPage() {
  const t = await getTranslations('manage');
  const locale = await getLocale();
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const action = createHeat.bind(null, locale);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t('createHeat')}</h1>
      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="categoryId">
            {t('category')}
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === 'he' ? c.nameHe : c.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="name">
            {t('heatName')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder={t('heatNamePlaceholder')}
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-full bg-ink px-6 py-2 font-semibold text-cream hover:brightness-110">
            {t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
