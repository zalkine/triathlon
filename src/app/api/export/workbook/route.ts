import { requireRole } from '@/lib/auth';
import { allExportSheets } from '@/lib/exports';
import { buildXlsx, xlsxResponse } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

// Every admin list in one Excel file, a sheet each — so the whole competition can
// be taken away in a single download instead of six, and printed or filed from
// one workbook. The per-list CSVs stay for anyone who wants just one of them.
export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const sheets = await allExportSheets();
  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(`triathlon-gal-on-${stamp}.xlsx`, buildXlsx(sheets));
}
