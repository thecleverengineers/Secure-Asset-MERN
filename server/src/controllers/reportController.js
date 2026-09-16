import PDFDocument from 'pdfkit';
import { resources } from '../services/resources.js';
import { buildScope } from '../services/scope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { canResourceAction } from '../services/rbac.js';
import { PlatformModule } from '../models/index.js';
import { createXlsxBuffer, XLSX_MIME } from '../services/xlsxWorkbook.js';

const MAX_ROWS = 5000;
const MAX_FIELDS = 30;

function getPath(source, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], source);
}

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvCell(value) {
  return `"${displayValue(value).replaceAll('"', '""')}"`;
}

function selectedFields(req, docs) {
  const requested = req.query.fields
    ? String(req.query.fields).split(',').map((field) => field.trim()).filter(Boolean)
    : [];
  const discovered = [...new Set(docs.flatMap((doc) => Object.keys(doc)))].filter((field) => !['__v'].includes(field));
  const fields = (requested.length ? requested : discovered).slice(0, MAX_FIELDS);
  return fields.length ? fields : ['_id'];
}

async function reportData(req) {
  const config = resources[req.params.resource];
  if (!config || !await canResourceAction(req.params.resource, req.user, 'export', config)) throw new ApiError(403, 'Report is unavailable');
  const scope = await buildScope(req.user, req.params.resource);
  const query = config.model.find(scope).sort('-createdAt').limit(MAX_ROWS);
  const populatePaths = Array.isArray(config.populate) ? config.populate : config.populate ? [config.populate] : [];
  populatePaths.forEach((path) => query.populate(path, '-password -refreshTokens -otpHash'));
  const docs = await query.lean();
  return { docs, fields: selectedFields(req, docs) };
}

function filename(resource, extension) {
  return `${String(resource).replace(/[^a-z0-9_-]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export const exportCsv = asyncHandler(async (req, res) => {
  const { docs, fields } = await reportData(req);
  const rows = [fields.map(csvCell).join(','), ...docs.map((doc) => fields.map((field) => csvCell(getPath(doc, field))).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename(req.params.resource, 'csv')}"`);
  res.send(`\uFEFF${rows.join('\n')}`);
});

export const exportXlsx = asyncHandler(async (req, res) => {
  const { docs, fields } = await reportData(req);
  const buffer = await createXlsxBuffer({
    columns: fields.map((field) => ({ header: field, key: field, width: Math.min(45, Math.max(14, field.length + 4)) })),
    rows: docs.map((doc) => fields.map((field) => displayValue(getPath(doc, field)))),
  });
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename(req.params.resource, 'xlsx')}"`);
  res.send(buffer);
});

export const exportPdf = asyncHandler(async (req, res) => {
  const { docs, fields } = await reportData(req);
  const limitedDocs = docs.slice(0, 500);
  const document = new PDFDocument({ size: 'A4', margin: 36, layout: fields.length > 6 ? 'landscape' : 'portrait', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename(req.params.resource, 'pdf')}"`);
  document.pipe(res);
  document.fontSize(18).text(`${req.params.resource.replaceAll('-', ' ')} report`, { continued: false });
  document.moveDown(0.3).fontSize(9).fillColor('#555').text(`Generated ${new Date().toLocaleString('en-IN')} · ${docs.length} records${docs.length > limitedDocs.length ? ` · first ${limitedDocs.length} shown` : ''}`);
  document.moveDown();
  for (const [index, row] of limitedDocs.entries()) {
    if (document.y > document.page.height - 90) document.addPage();
    document.fillColor('#111').fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${displayValue(getPath(row, fields[0])) || 'Record'}`);
    document.font('Helvetica').fontSize(8.5);
    for (const field of fields.slice(1)) {
      const value = displayValue(getPath(row, field));
      if (!value) continue;
      document.fillColor('#555').text(`${field}: `, { continued: true }).fillColor('#111').text(value.slice(0, 800));
    }
    document.moveDown(0.55);
  }
  document.end();
});


export const reportCatalog = asyncHandler(async (req, res) => {
  const candidates = [];
  for (const [key, config] of Object.entries(resources)) {
    if (await canResourceAction(key, req.user, 'export', config)) candidates.push([key, config]);
  }
  const moduleRows = await PlatformModule.find({ scope: 'app', key: { $in: candidates.map(([key]) => key) } }).select('key label description section enabled').lean();
  const metadata = new Map(moduleRows.map((row) => [row.key, row]));
  const data = await Promise.all(candidates.map(async ([key, config]) => {
    const module = metadata.get(key);
    const scope = await buildScope(req.user, key);
    const count = await config.model.countDocuments(scope);
    return { key, label: module?.label || key.replaceAll('-', ' ').replace(/\b\w/g, (value) => value.toUpperCase()), description: module?.description || 'Permission-scoped operational records', section: module?.section || 'operations', count, enabled: module?.enabled !== false, formats: ['csv', 'xlsx', 'pdf'] };
  }));
  res.json({ success: true, data: data.filter((item) => item.enabled).sort((a, b) => a.section.localeCompare(b.section) || a.label.localeCompare(b.label)) });
});
