import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

// Advertise support for both schemes so browsers (including Samsung Internet,
// which ignores `color-scheme: light only`) render our own dark theme instead
// of force-inverting the light palette. The actual `color-scheme` and the
// browser-chrome `theme-color` are set per-theme by the pre-paint script below
// so they track a manual override, not just the OS setting.
export const viewport: Viewport = {
  colorScheme: 'light dark',
};

// Runs before first paint to prevent a flash of the wrong theme. Defaults to
// the phone's `prefers-color-scheme` and honours a saved override written by
// the header toggle (localStorage `theme` = 'light' | 'dark'; unset = follow
// the OS). Keep this in sync with ThemeToggle's apply logic.
const themeScript = `(function(){try{
  var s=localStorage.getItem('theme');
  var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',d);
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
  m.setAttribute('content',d?'#0f1a1f':'#eef4f4');
}catch(e){}})();`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brand' });
  return {
    title: t('name'),
    description: t('tagline'),
    icons: { icon: '/favicon.png' },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
