type ExcelCell = string | number | boolean | null | undefined;

function xmlEscape(value: ExcelCell) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function columnName(index: number) {
  let value = index + 1, result = '';
  while (value > 0) { const r = (value - 1) % 26; result = String.fromCharCode(65 + r) + result; value = Math.floor((value - 1) / 26); }
  return result;
}
export async function downloadXlsx(filename: string, sheetName: string, rows: ExcelCell[][]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const safeSheetName = String(sheetName || 'Sheet1').replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Sheet1';
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ''}><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const maxColumns = Math.max(1, ...rows.map((row) => row.length));
  const cols = Array.from({ length: maxColumns }, (_, index) => {
    const width = Math.min(40, Math.max(12, ...rows.map((row) => String(row[index] ?? '').length + 2)));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder('xl')?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder('xl')?.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Open Sans"/></font><font><b/><sz val="11"/><name val="Open Sans"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${columnName(maxColumns - 1)}${Math.max(1, rows.length)}"/></worksheet>`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
