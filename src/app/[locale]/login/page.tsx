import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import LoginForm from '@/components/LoginForm';
import { loginAction } from '@/actions/auth';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('login');
  const action = loginAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <LoginForm action={action} />
      </main>
    </div>
  );
}
