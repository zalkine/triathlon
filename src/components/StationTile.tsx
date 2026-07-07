import { Link } from '@/i18n/navigation';

const COLORS: Record<string, string> = {
  checkin: 'bg-swim-dark text-white',
  start: 'bg-ink text-cream',
  swim: 'bg-swim text-ink',
  bike: 'bg-bike text-ink',
  run: 'bg-run text-white',
};

export default function StationTile({ href, title, desc, station }: { href: string; title: string; desc: string; station: string }) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 rounded-2xl p-8 shadow-sm transition hover:brightness-95 ${COLORS[station] ?? 'bg-white'}`}
    >
      <span className="text-2xl font-bold">{title}</span>
      <span className="text-sm opacity-90">{desc}</span>
    </Link>
  );
}
