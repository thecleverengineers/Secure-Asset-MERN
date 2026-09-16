import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { createXlsxBuffer } from '../server/src/services/xlsxWorkbook.js';

test('controlled XLSX writer creates an escaped, readable workbook', async () => {
  const buffer = await createXlsxBuffer({
    sheetName: 'Security / Report',
    columns: [{ header: 'Field', width: 18 }, { header: 'Value', width: 30 }],
    rows: [['payload', '<script>alert(1)</script>'], ['multiline', 'line\nvalue']],
  });
  const zip = await JSZip.loadAsync(buffer);
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const workbook = await zip.file('xl/workbook.xml').async('string');
  assert.match(sheet, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(workbook, /Security   Report/); // slash is replaced because Excel sheet names cannot contain it
  assert.match(sheet, /autoFilter/);
  assert.ok((await zip.file('xl/styles.xml').async('string')).includes('0B5270'));
});

test('production dependency policy removes the vulnerable ExcelJS chain', async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.dependencies.exceljs, undefined);
  assert.equal(packageJson.dependencies.archiver, '^8.0.0');
  assert.equal(packageJson.dependencies['react-router'], '8.3.0');
  assert.equal(packageJson.overrides['js-yaml'], '5.2.2');
  assert.equal(packageJson.overrides['brace-expansion'], '5.0.9');
  assert.equal(packageJson.overrides['ip-address'], '10.4.0');
  assert.equal(packageJson.overrides['socket.io-parser'], '4.2.7');
});
