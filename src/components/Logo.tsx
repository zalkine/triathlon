import { useTranslations } from 'next-intl';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('brand');
  // Icon-only mark next to the localized name (the mark's baked-in Hebrew
  // wordmark is too small to read at header sizes, and this stays bilingual).
  const dims = size === 'lg' ? 'h-16' : size === 'sm' ? 'h-9' : 'h-12';

  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" className={`${dims} w-auto`} />
      <span className={size === 'lg' ? 'text-3xl font-bold' : 'text-xl font-bold'}>{t('name')}</span>
    </div>
  );
}
