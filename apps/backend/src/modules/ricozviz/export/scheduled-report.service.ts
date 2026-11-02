// ============================================================
// Scheduled Report Service (PDF Generation & Email Dispatch)
// ============================================================
// Wires automated report execution with:
// 1. Dashboard schema & data extraction
// 2. Server-side headless Puppeteer PDF compilation
// 3. Outbound email delivery with the generated PDF attached via nodemailer
// 4. ReportExecution logging for auditing and observability
// ============================================================

import mongoose from 'mongoose';
import {
  ChartModel,
  DashboardModel,
  DatasetModel,
  ReportExecutionModel,
  ReportModel,
  UserModel,
  toObjectId
} from '@repo/database';
import { REPORT_EXECUTION_STATUS } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { getEmailTransporter } from '../alert/notification.service.js';
import { generateDashboardPdf } from './pdf-generator.service.js';
import type { DashboardChartData } from './pdf-generator.service.js';
import { getDatasetColumnNames, queryRawDatasetPage } from './export.service.js';

export interface ScheduledReportExecutionResult {
  executionId: string;
  reportId: string;
  reportName: string;
  dashboardName: string;
  status: 'SUCCESS' | 'FAILED';
  durationMs: number;
  chartCount: number;
  totalRecords: number;
  recipients: string[];
  pdfSizeBytes: number;
  errorMessage?: string;
}

/**
 * Executes a scheduled report: gathers dashboard data, generates a Puppeteer PDF,
 * and delivers the PDF to configured recipients via nodemailer with attachment.
 */
export async function executeScheduledReport(
  reportId: string,
  callerContext?: { userId?: string; organizationId?: string }
): Promise<ScheduledReportExecutionResult> {
  const startTime = Date.now();
  const reportObjectId = toObjectId(reportId);

  if (!reportObjectId) {
    throw AppError.badRequest('Invalid report ID format');
  }

  const report = await ReportModel.findById(reportObjectId).lean();
  if (!report) {
    throw AppError.notFound(`Report with ID "${reportId}" not found`);
  }

  const dashboard = await DashboardModel.findById(report.dashboardId).lean();
  if (!dashboard) {
    throw AppError.notFound(`Associated dashboard for report "${report.name}" not found`);
  }

  // 1. Fetch dashboard charts and their datasets
  const charts = await ChartModel.find({ dashboardId: dashboard._id }).lean();
  const dashboardChartsData: DashboardChartData[] = [];
  let totalRecords = 0;

  for (const chart of charts) {
    let chartRows: Record<string, unknown>[] = [];
    let cols: string[] = [];

    if (chart.datasetId) {
      const dataset = await DatasetModel.findById(chart.datasetId).lean();
      if (dataset) {
        cols = getDatasetColumnNames(dataset.schemaMeta);
        try {
          const page = queryRawDatasetPage(dataset, { limit: 250, offset: 0 });
          chartRows = page.rows || [];
          totalRecords += chartRows.length;
        } catch {
          chartRows = [];
        }
      }
    }

    dashboardChartsData.push({
      title: chart.title || 'Visualization',
      chartType: chart.chartType || 'TABLE',
      columns: cols,
      rows: chartRows
    });
  }

  // 2. Generate PDF via Puppeteer
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateDashboardPdf({
      title: dashboard.name,
      description: dashboard.description,
      charts: dashboardChartsData,
      exportedAt: new Date()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;
    await ReportExecutionModel.create({
      reportId: report._id,
      dashboardId: dashboard._id,
      status: REPORT_EXECUTION_STATUS.FAILED,
      durationMs,
      chartCount: charts.length,
      totalRecords,
      summary: { error: errorMsg },
      errorMessage: errorMsg
    });

    throw AppError.internal(`Failed to generate dashboard PDF: ${errorMsg}`);
  }

  // 3. Resolve email recipients
  const deliveryConfig = (report.deliveryConfig || {}) as Record<string, unknown>;
  const recipients: string[] = [];

  if (Array.isArray(deliveryConfig.recipients)) {
    for (const r of deliveryConfig.recipients) {
      if (typeof r === 'string' && r.includes('@')) recipients.push(r.trim());
    }
  }
  if (Array.isArray(deliveryConfig.emails)) {
    for (const r of deliveryConfig.emails) {
      if (typeof r === 'string' && r.includes('@') && !recipients.includes(r.trim())) {
        recipients.push(r.trim());
      }
    }
  }

  // If no recipients specified in deliveryConfig, fall back to report creator or caller
  if (recipients.length === 0 && report.createdById) {
    const creator = await UserModel.findById(report.createdById).select('email').lean();
    if (creator?.email) recipients.push(creator.email);
  }

  if (recipients.length === 0 && process.env.REPORT_FALLBACK_EMAIL) {
    recipients.push(process.env.REPORT_FALLBACK_EMAIL);
  }

  // 4. Send email via nodemailer with attached PDF
  let dispatchError: string | undefined;
  if (recipients.length > 0) {
    try {
      const transporter = getEmailTransporter();
      const sanitizedName = dashboard.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${sanitizedName}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const fromAddress = process.env.SMTP_FROM || 'RicozViz Reports <reports@ricozviz.io>';

      await transporter.sendMail({
        from: fromAddress,
        to: recipients.join(', '),
        subject: `[Scheduled Report] ${dashboard.name} (${new Date().toLocaleDateString()})`,
        text: `Your scheduled report for dashboard "${dashboard.name}" has been generated. Please find the attached PDF report.`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #fafafa; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #181818; border: 1px solid #2e2e2e; border-radius: 12px; padding: 24px;">
    <div style="font-family: monospace; font-size: 11px; color: #ff6b35; margin-bottom: 8px;">SCHEDULED REPORT DELIVERY</div>
    <h2 style="margin: 0 0 12px 0; color: #ffffff;">${dashboard.name}</h2>
    <p style="color: #b4b4b4; font-size: 13px; line-height: 1.5;">
      Your automated dashboard snapshot has been generated by RicozViz Intelligence OS.
      The complete executive PDF report is attached to this email.
    </p>
    <div style="background: #121212; border: 1px solid #282828; border-radius: 8px; padding: 12px; margin: 16px 0; font-family: monospace; font-size: 11px; color: #898989;">
      <div>Charts: ${charts.length}</div>
      <div>Records Evaluated: ${totalRecords.toLocaleString()}</div>
      <div>PDF Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB</div>
    </div>
    <div style="font-size: 11px; color: #666666; border-top: 1px solid #242424; padding-top: 12px; margin-top: 20px; font-family: monospace;">
      RicozViz Intelligence OS · Governed Automated Analytics
    </div>
  </div>
</body>
</html>`,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      logger.info('[ScheduledReport] Delivered scheduled report PDF via email', {
        reportId,
        dashboardId: dashboard._id.toString(),
        recipients,
        pdfSizeBytes: pdfBuffer.length
      });
    } catch (sendErr: unknown) {
      dispatchError = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error('[ScheduledReport] Email dispatch failed', { error: dispatchError });
    }
  }

  const durationMs = Date.now() - startTime;
  const executionStatus = dispatchError ? REPORT_EXECUTION_STATUS.FAILED : REPORT_EXECUTION_STATUS.SUCCESS;

  const execution = await ReportExecutionModel.create({
    reportId: report._id,
    dashboardId: dashboard._id,
    status: executionStatus,
    durationMs,
    chartCount: charts.length,
    totalRecords,
    summary: {
      recipients,
      pdfSizeBytes: pdfBuffer.length,
      format: 'PDF',
      callerUserId: callerContext?.userId || null
    },
    errorMessage: dispatchError || null
  });

  return {
    executionId: execution._id.toString(),
    reportId: report._id.toString(),
    reportName: report.name,
    dashboardName: dashboard.name,
    status: dispatchError ? 'FAILED' : 'SUCCESS',
    durationMs,
    chartCount: charts.length,
    totalRecords,
    recipients,
    pdfSizeBytes: pdfBuffer.length,
    errorMessage: dispatchError
  };
}

/**
 * Lists execution history logs for a specific scheduled report.
 */
export async function listReportExecutions(reportId: string): Promise<Record<string, unknown>[]> {
  const reportObjectId = toObjectId(reportId);
  if (!reportObjectId) return [];

  const executions = await ReportExecutionModel.find({ reportId: reportObjectId })
    .sort({ executedAt: -1 })
    .limit(50)
    .lean();

  return executions.map((ex) => ({
    id: ex._id.toString(),
    reportId: ex.reportId.toString(),
    dashboardId: ex.dashboardId.toString(),
    status: ex.status,
    executedAt: ex.executedAt.toISOString(),
    durationMs: ex.durationMs,
    chartCount: ex.chartCount,
    totalRecords: ex.totalRecords,
    summary: ex.summary,
    errorMessage: ex.errorMessage
  }));
}
