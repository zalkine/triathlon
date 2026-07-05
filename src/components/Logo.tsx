import { useTranslations } from 'next-intl';
import LogoMark from './LogoMark';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('brand');
  const dims = size === 'lg' ? 'h-24' : size === 'sm' ? 'h-8' : 'h-14';

  return (
    <div className="flex items-center gap-3">
      <LogoMark className={dims} />
      <span className={size === 'lg' ? 'text-3xl font-bold' : 'text-xl font-bold'}>{t('name')}</span>
    </div>
  );
}
