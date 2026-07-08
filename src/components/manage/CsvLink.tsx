// Plain admin CSV download link. The /api/export/* routes enforce ADMIN.
export default function CsvLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5"
    >
      ↓ {label}
    </a>
  );
}
