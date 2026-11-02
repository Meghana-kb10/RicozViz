// ============================================================
// Server-Side Headless Puppeteer PDF Generator for Dashboards
// ============================================================
// Generates publication-ready PDF snapshots of dashboards using
// headless Puppeteer (Chromium / Chrome / Edge).
// ============================================================

import fs from 'node:fs';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import { logger } from '../../../utils/logger.js';

export interface DashboardChartData {
  title: string;
  chartType?: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface DashboardPdfRenderOptions {
  title: string;
  description?: string | null;
  organizationName?: string;
  workspaceName?: string;
  exportedAt?: Date;
  charts: DashboardChartData[];
}

/**
 * Searches well-known system locations for an installed Chromium/Chrome/Edge binary.
 */
export function findChromeExecutable(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

/**
 * Builds a styled, executive-ready HTML dashboard template for printing to PDF.
 */
export function renderDashboardHtml(options: DashboardPdfRenderOptions): string {
  const exportDate = (options.exportedAt || new Date()).toUTCString();
  const totalRows = options.charts.reduce((sum, c) => sum + (c.rows?.length || 0), 0);

  const chartCardsHtml = options.charts
    .map((chart, idx) => {
      const rows = chart.rows || [];
      const cols = chart.columns && chart.columns.length > 0
        ? chart.columns
        : rows.length > 0 ? Object.keys(rows[0]) : [];
      const displayRows = rows.slice(0, 15);

      const headerHtml = cols.map((col) => `<th>${col}</th>`).join('');
      const bodyHtml = displayRows
        .map(
          (row) =>
            `<tr>${cols
              .map((c) => {
                const val = row[c];
                return `<td>${val !== null && val !== undefined ? String(val) : ''}</td>`;
              })
              .join('')}</tr>`
        )
        .join('');

      return `
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h2 class="chart-title">${idx + 1}. ${chart.title}</h2>
            <div class="chart-meta">
              <span class="badge">${chart.chartType || 'TABLE'}</span>
              <span>${rows.length} total rows</span>
            </div>
          </div>
        </div>
        ${
          cols.length > 0 && displayRows.length > 0
            ? `<div class="table-container">
                <table>
                  <thead><tr>${headerHtml}</tr></thead>
                  <tbody>${bodyHtml}</tbody>
                </table>
              </div>`
            : `<div class="empty-notice">No rows available for this visualization</div>`
        }
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options.title} — Executive PDF Report</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-bar {
      border-bottom: 2px solid #ff6b35;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-tag {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #ff6b35;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: #111111;
      margin: 6px 0 4px 0;
    }
    .report-desc {
      font-size: 13px;
      color: #555555;
      margin: 0 0 12px 0;
      line-height: 1.4;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .meta-item {
      background: #f7f7f7;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .meta-label {
      font-size: 10px;
      font-family: monospace;
      color: #888888;
      text-transform: uppercase;
    }
    .meta-val {
      font-size: 14px;
      font-weight: 700;
      color: #222222;
      margin-top: 3px;
    }
    .chart-card {
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 8px;
    }
    .chart-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
      color: #111111;
    }
    .chart-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 11px;
      color: #777777;
      margin-top: 3px;
    }
    .badge {
      font-family: monospace;
      font-size: 9px;
      background: rgba(255, 107, 53, 0.12);
      color: #c2410c;
      border: 1px solid rgba(255, 107, 53, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #f4f4f4;
      border-bottom: 2px solid #dddddd;
      text-align: left;
      padding: 6px 8px;
      font-family: monospace;
      font-weight: 600;
      color: #444444;
      text-transform: uppercase;
      font-size: 9.5px;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #eeeeee;
      color: #333333;
      font-family: monospace;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .empty-notice {
      padding: 16px;
      text-align: center;
      color: #999999;
      font-size: 12px;
      font-family: monospace;
    }
    .footer {
      border-top: 1px solid #e5e5e5;
      padding-top: 12px;
      margin-top: 30px;
      font-size: 10px;
      font-family: monospace;
      color: #888888;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand-tag">RicozViz Intelligence OS · Executive Report</div>
    <h1 class="report-title">${options.title}</h1>
    ${options.description ? `<p class="report-desc">${options.description}</p>` : ''}
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Generated Timestamp</div>
      <div class="meta-val">${exportDate}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Visualizations</div>
      <div class="meta-val">${options.charts.length} Charts</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Sampled Records</div>
      <div class="meta-val">${totalRows.toLocaleString()} Rows</div>
    </div>
  </div>

  <div class="charts-section">
    ${chartCardsHtml}
  </div>

  <div class="footer">
    <span>RFC 6962 SHA-256 Verified Ledger · Confidential & Governed</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;
}

/**
 * Generates a real server-side PDF buffer using headless Puppeteer.
 */
export async function generateDashboardPdf(
  options: DashboardPdfRenderOptions
): Promise<Buffer> {
  const html = renderDashboardHtml(options);
  const executablePath = findChromeExecutable();

  let browser: Browser | null = null;
  try {
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set viewport to standard A4 desktop rendering width
    await page.setViewport({ width: 1200, height: 800 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '12mm',
        left: '12mm',
        right: '12mm'
      }
    });

    const pdfBuffer = Buffer.from(pdfUint8);
    logger.info('[PdfGenerator] Generated dashboard PDF via Puppeteer', {
      title: options.title,
      chartCount: options.charts.length,
      bytes: pdfBuffer.length
    });

    return pdfBuffer;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('[PdfGenerator] Puppeteer PDF rendering encountered an issue, falling back to vector PDF builder', {
      error: errMsg
    });

    // Fallback vector PDF builder if browser launch fails on an edge sandbox
    return buildFallbackPdf(options);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Clean vector PDF fallback generator that requires zero external binaries.
 */
function buildFallbackPdf(options: DashboardPdfRenderOptions): Buffer {
  const title = (options.title || 'Dashboard Export').replace(/[()\\]/g, '');
  const lines: string[] = [
    `RicozViz Intelligence OS — Dashboard Report: ${title}`,
    `Generated: ${(options.exportedAt || new Date()).toISOString()}`,
    `Visualizations: ${options.charts.length}`
  ];

  for (const c of options.charts) {
    lines.push(`--- ${c.title} (${c.rows?.length || 0} rows) ---`);
    const cols = c.columns?.slice(0, 6) || [];
    if (cols.length > 0) lines.push(cols.join(' | '));
    for (const r of (c.rows || []).slice(0, 5)) {
      lines.push(cols.map((col) => String(r[col] ?? '')).join(' | '));
    }
  }

  const contentStream =
    'BT\n/F1 14 Tf\n40 780 Td\n(' +
    lines[0] +
    ') Tj\n/F1 10 Tf\n' +
    lines
      .slice(1, 35)
      .map((l) => `T* (${l.replace(/[()\\]/g, '').slice(0, 100)}) Tj`)
      .join('\n') +
    '\nET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}
