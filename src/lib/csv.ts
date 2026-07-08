// Minimal RFC-4180 CSV builder. Quotes any field containing a comma, quote,
// or newline, and doubles embedded quotes. A leading BOM makes Excel open
// UTF-8 (Hebrew) files correctly.
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows.map((row) => row.map(escape).join(',')).join('\r\n');
  return '﻿' + body;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
