import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import RegisterForm from '@/components/RegisterForm';
import { registerAction } from '@/actions/registrants';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('register');
  const categories = await prisma.category.findMany({ select: { key: true, nameEn: true, nameHe: true } });
  const action = registerAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <RegisterForm action={action} categories={categories} />
      </main>
    </div>
  );
}
