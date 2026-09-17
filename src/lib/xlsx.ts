import { deflateRawSync, crc32 } from 'zlib';

// Minimal .xlsx writer — a real Excel workbook with one sheet per list, built
// from scratch rather than pulling in a spreadsheet library. An .xlsx file is a
// ZIP of XML parts, and the handful we need (content types, workbook, styles and
// a sheet each) are small and fixed, so the whole thing is a few dozen lines with
// no dependency to keep patched.
//
// Values are written as inline strings or numbers, which avoids the shared-string
// table entirely. Header rows are bold and frozen so a long roster stays readable
// when scrolled.

export type SheetData = {
  /** Tab name. Trimmed to what Excel accepts (see `sheetName`). */
  name: string;
  rows: (string | number | null | undefined)[][];
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are not legal in XML 1.0 and make Excel reject the file.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** A1-style column name: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; ) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * Excel refuses a tab name that is empty, over 31 characters or contains
 * : \ / ? * [ ], and refuses a workbook with two tabs of the same name — any of
 * which would make the whole download fail to open, so names are repaired here
 * rather than trusted.
 */
export function sheetName(raw: string, taken: Set<string>): string {
  let name = (raw || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  if (taken.has(name.toLowerCase())) {
    for (let i = 2; ; i++) {
      const suffix = ` (${i})`;
      const candidate = name.slice(0, 31 - suffix.length) + suffix;
      if (!taken.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }
  }
  taken.add(name.toLowerCase());
  return name;
}

function sheetXml(rows: SheetData['rows']): string {
  const widths = new Map<number, number>();
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`;
          // Bold style for the header row (see styles.xml below).
          const style = r === 0 ? ' s="1"' : '';
          if (value == null || value === '') return '';
          const text = String(value);
          widths.set(c, Math.max(widths.get(c) ?? 10, Math.min(text.length + 2, 60)));
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"${style}><v>${value}</v></c>`;
          }
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  const cols = [...widths.entries()]
    .map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // Keep the header row on screen while scrolling a long list.
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${body}</sheetData>` +
    '</worksheet>'
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  // Excel expects a named default style; without it some readers warn.
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** Builds a complete .xlsx workbook. Sheets keep the order given. */
export function buildXlsx(sheets: SheetData[]): Buffer {
  const taken = new Set<string>();
  const named = (sheets.length > 0 ? sheets : [{ name: 'Sheet', rows: [] }]).map((s) => ({
    name: sheetName(s.name, taken),
    rows: s.rows,
  }));

  const files: { path: string; data: Buffer }[] = [
    {
      path: '[Content_Types].xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          named
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
            )
            .join('') +
          '</Types>',
        'utf8'
      ),
    },
    {
      path: '_rels/.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
        'utf8'
      ),
    },
    {
      path: 'xl/workbook.xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          named
            .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join('') +
          '</sheets></workbook>',
        'utf8'
      ),
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          named
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
            )
            .join('') +
          `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          '</Relationships>',
        'utf8'
      ),
    },
    { path: 'xl/styles.xml', data: Buffer.from(STYLES_XML, 'utf8') },
    ...named.map((s, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s.rows), 'utf8'),
    })),
  ];

  return zip(files);
}

// --- Minimal ZIP container (deflate, no encryption, no zip64) --------------

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function zip(files: { path: string; data: Buffer }[]): Buffer {
  const { time, date } = dosDateTime(new Date());
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const compressed = deflateRawSync(file.data);
    const crc = crc32(file.data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, ...centrals, end]);
}

export function xlsxResponse(filename: string, workbook: Buffer): Response {
  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
