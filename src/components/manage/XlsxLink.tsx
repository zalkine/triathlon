// The whole competition as one Excel workbook, a sheet per list. Styled apart
// from the plain CSV links beside it because it is the download most admins
// want: one file, everything in it. The /api/export/* routes enforce ADMIN.
export default function XlsxLink({
  href = '/api/export/workbook',
  label,
  hint,
}: {
  href?: string;
  label: string;
  hint?: string;
}) {
  return (
    <a
      href={href}
      download
      className="inline-flex flex-col rounded-2xl border border-swim-dark/40 bg-swim/10 px-4 py-2 hover:brightness-95"
    >
      <span className="text-sm font-semibold">⬇ {label}</span>
      {hint && <span className="text-xs font-normal text-ink-light">{hint}</span>}
    </a>
  );
}
