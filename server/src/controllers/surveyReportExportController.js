import { SurveyReport } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { createXlsxBuffer, XLSX_MIME } from '../services/xlsxWorkbook.js';

function sameId(a, b) { return a && b && String(a?._id || a) === String(b?._id || b); }
function flatten(value, prefix = '', out = {}) {
  if (value === null || value === undefined) { out[prefix] = ''; return out; }
  if (Array.isArray(value)) { out[prefix] = JSON.stringify(value); return out; }
  if (typeof value === 'object' && !(value instanceof Date)) { Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, out)); return out; }
  out[prefix] = value; return out;
}
function escapeXml(value) { return String(value ?? '').replace(/[<>&'"]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[m])); }
async function loadReport(req) {
  const report = await SurveyReport.findById(req.params.id).populate('project').populate('client', 'name email phone').populate('surveyor', 'name email phone').lean();
  if (!report) throw new ApiError(404, 'Survey report not found');
  if (req.user.role !== 'admin' && !sameId(report.surveyor, req.user._id) && !sameId(report.client, req.user._id)) throw new ApiError(403, 'Report access denied');
  return report;
}

export const exportSurveyReport = asyncHandler(async (req, res) => {
  const report = await loadReport(req); const format = String(req.query.format || 'pdf').toLowerCase();
  const filename = report.reportNumber || String(report._id);
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`); return res.json(report);
  }
  if (format === 'csv') {
    const flat = flatten(report); const rows = [['Field', 'Value'], ...Object.entries(flat)];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`); return res.send(`\uFEFF${csv}`);
  }
  if (format === 'html') {
    const sections = Object.entries(report.sections || {}).map(([key, value]) => `<section><h2>${escapeXml(key)}</h2><pre>${escapeXml(JSON.stringify(value, null, 2))}</pre></section>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(filename)}</title><style>body{font-family:"Open Sans",Arial,sans-serif;margin:40px;color:#172033}h1{font-size:30px}h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:8px}pre{white-space:pre-wrap;background:#f6f7f9;padding:16px;border-radius:10px}.meta{color:#64748b}</style></head><body><h1>${escapeXml(report.title || report.type)}</h1><p class="meta">Report ${escapeXml(filename)} · Revision ${report.revisionNumber || 0} · ${escapeXml(report.status)}</p><p><strong>Surveyor:</strong> ${escapeXml(report.surveyor?.name)}</p><p><strong>Client:</strong> ${escapeXml(report.client?.name)}</p>${sections}<p><strong>Digital signature:</strong> ${escapeXml(report.digitalSignature || 'Not signed')}</p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`); return res.send(html);
  }
  if (format === 'svg' || format === 'image') {
    const summary = escapeXml(JSON.stringify(report.sections || {}).slice(0, 900));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="70" y="70" width="1060" height="1460" rx="28" fill="white" stroke="#dbe3ee"/><text x="120" y="170" font-family="Open Sans, Arial, sans-serif" font-size="52" font-weight="700" fill="#172033">${escapeXml(report.title || report.type)}</text><text x="120" y="225" font-family="Open Sans, Arial, sans-serif" font-size="24" fill="#64748b">${escapeXml(filename)} · ${escapeXml(report.status)}</text><text x="120" y="300" font-family="Open Sans, Arial, sans-serif" font-size="26" fill="#172033">Surveyor: ${escapeXml(report.surveyor?.name)}</text><text x="120" y="345" font-family="Open Sans, Arial, sans-serif" font-size="26" fill="#172033">Client: ${escapeXml(report.client?.name)}</text><foreignObject x="120" y="410" width="960" height="900"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Open Sans',Arial,sans-serif;font-size:22px;line-height:1.5;color:#334155;white-space:pre-wrap">${summary}</div></foreignObject><text x="120" y="1450" font-family="Open Sans, Arial, sans-serif" font-size="20" fill="#64748b">Digitally signed: ${escapeXml(report.digitalSignature || 'No')}</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.svg"`); return res.send(svg);
  }
  if (format === 'xlsx') {
    const buffer = await createXlsxBuffer({
      sheetName: 'Survey Report',
      columns: [{ header: 'Field', key: 'field', width: 38 }, { header: 'Value', key: 'value', width: 90 }],
      rows: Object.entries(flatten(report)).map(([field, value]) => [field, typeof value === 'object' ? JSON.stringify(value) : value]),
    });
    res.setHeader('Content-Type', XLSX_MIME); res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`); return res.send(buffer);
  }
  if (format === 'pdf') {
    const { default: PDFDocument } = await import('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: report.title || report.type, Author: report.surveyor?.name || 'Surveyor' } });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`); doc.pipe(res);
    doc.fontSize(24).text(report.title || report.type, { align: 'center' }); doc.moveDown();
    doc.fontSize(10).fillColor('#64748b').text(`Report: ${filename} | Revision: ${report.revisionNumber || 0} | Status: ${report.status}`, { align: 'center' }); doc.fillColor('#111827').moveDown(2);
    doc.fontSize(12).text(`Surveyor: ${report.surveyor?.name || ''}`); doc.text(`Client: ${report.client?.name || ''}`); doc.text(`Issue date: ${report.issueDate ? new Date(report.issueDate).toLocaleDateString('en-IN') : ''}`); doc.moveDown();
    for (const [key, value] of Object.entries(report.sections || {})) { doc.fontSize(15).fillColor('#172033').text(key.replaceAll('_', ' '), { underline: true }); doc.moveDown(.4); doc.fontSize(10).fillColor('#334155').text(typeof value === 'string' ? value : JSON.stringify(value, null, 2)); doc.moveDown(); }
    doc.fontSize(10).fillColor('#64748b').text(`Digital signature: ${report.digitalSignature || 'Not signed'}`); doc.end(); return;
  }
  throw new ApiError(422, 'Supported formats: pdf, xlsx, csv, json, html, svg');
});
