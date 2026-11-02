// ============================================================
// Real Outbound Notification Service (SMTP Email & Slack Webhook)
// ============================================================
// Dispatches live alert notifications to:
// 1. SMTP via nodemailer (HTML + Plaintext alert payload)
// 2. Slack Incoming Webhooks (Block Kit structured payload)
//
// Records delivery tracking status (DELIVERED | FAILED | SKIPPED | NOT_CONFIGURED)
// with timestamp and error details for auditability.
// ============================================================

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../../../utils/logger.js';

export interface AlertNotificationPayload {
  alertId: string;
  alertName: string;
  metricName: string;
  condition: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  recipients?: string[];
  slackWebhookUrl?: string | null;
  fallbackEmail?: string;
}

export interface NotificationDispatchResult {
  deliveryStatus: 'DELIVERED' | 'FAILED' | 'SKIPPED' | 'NOT_CONFIGURED';
  deliveryChannel: string | null;
  deliveredAt: Date | null;
  deliveryError: string | null;
}

let cachedTransporter: Transporter | null = null;

/**
 * Creates or retrieves the cached nodemailer transporter.
 * If SMTP credentials are configured in environment variables, uses them.
 * Otherwise, in test or development without SMTP configured, creates a JSON/stream transporter
 * so emails can be generated, validated, and logged without external socket dependencies.
 */
export function getEmailTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  if (smtpHost && smtpUser) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    logger.info(`[NotificationService] Configured live SMTP transporter (${smtpHost}:${smtpPort})`);
  } else {
    // Development / Test in-memory JSON transporter (builds complete RFC 2822 messages)
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    logger.info('[NotificationService] Configured local JSON email transporter (no live SMTP host provided)');
  }

  return cachedTransporter;
}

/**
 * Generates an accessible, obsidian + coral styled HTML email template for alert triggers.
 */
export function buildAlertHtml(payload: {
  alertName: string;
  metricName: string;
  condition: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RicozViz Alert: ${payload.alertName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #fafafa; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #181818; border: 1px solid #2e2e2e; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1c1c1c 0%, #241410 100%); padding: 24px; border-bottom: 1px solid #ff6b35; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-family: monospace; background: rgba(255, 107, 53, 0.15); color: #ff6b35; border: 1px solid rgba(255, 107, 53, 0.3); }
    .title { margin: 12px 0 0 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    .content { padding: 24px; }
    .stat-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; margin-bottom: 20px; }
    .stat-item { background-color: #121212; border: 1px solid #262626; border-radius: 8px; padding: 12px; }
    .stat-label { font-size: 11px; font-family: monospace; text-transform: uppercase; color: #898989; }
    .stat-val { font-size: 16px; font-weight: bold; color: #fafafa; margin-top: 4px; }
    .stat-alert { color: #ff6b35; }
    .footer { padding: 16px 24px; background-color: #141414; border-top: 1px solid #242424; font-size: 11px; color: #666666; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">ALERT TRIGGERED</span>
      <h1 class="title">${payload.alertName}</h1>
    </div>
    <div class="content">
      <p style="color: #b4b4b4; font-size: 14px; margin: 0 0 16px 0;">
        Metric <strong>${payload.metricName}</strong> has triggered an automated alert condition.
      </p>
      <div class="stat-box">
        <div class="stat-item">
          <div class="stat-label">Current Reading</div>
          <div class="stat-val stat-alert">${payload.currentValue}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Threshold (${payload.condition})</div>
          <div class="stat-val">${payload.threshold}</div>
        </div>
      </div>
      <p style="font-size: 12px; color: #898989; margin: 0;">
        Timestamp: ${payload.triggeredAt.toISOString()}
      </p>
    </div>
    <div class="footer">
      RicozViz Intelligence OS · Automated OLAP Metric Monitor
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends outbound email notification via nodemailer.
 */
export async function sendEmailAlert(
  recipients: string[],
  payload: {
    alertName: string;
    metricName: string;
    condition: string;
    threshold: number;
    currentValue: number;
    triggeredAt: Date;
  }
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = process.env.SMTP_FROM || 'RicozViz Alerts <alerts@ricozviz.io>';
    const subject = `[ALERT] ${payload.alertName}: ${payload.metricName} is ${payload.currentValue} (${payload.condition} ${payload.threshold})`;
    const html = buildAlertHtml(payload);
    const text = `ALERT TRIGGERED: ${payload.alertName}\nMetric: ${payload.metricName}\nCurrent: ${payload.currentValue}\nThreshold: ${payload.condition} ${payload.threshold}\nTime: ${payload.triggeredAt.toISOString()}`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject,
      text,
      html
    });

    const messageId = typeof info.messageId === 'string' ? info.messageId : 'local-dispatch';
    logger.info('[NotificationService] Email alert dispatched successfully', {
      recipients,
      alertName: payload.alertName,
      messageId
    });

    return { success: true, messageId };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationService] Email alert dispatch failed', {
      recipients,
      error: errMsg
    });
    return { success: false, error: errMsg };
  }
}

/**
 * Sends outbound Slack webhook notification using Slack Block Kit.
 */
export async function sendSlackAlert(
  webhookUrl: string,
  payload: {
    alertName: string;
    metricName: string;
    condition: string;
    threshold: number;
    currentValue: number;
    triggeredAt: Date;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      return { success: false, error: 'Invalid Slack webhook URL protocol' };
    }

    const slackBody = {
      text: `🚨 Alert Triggered: ${payload.alertName} (${payload.metricName}: ${payload.currentValue})`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Alert: ${payload.alertName}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Metric:*\n${payload.metricName}`
            },
            {
              type: 'mrkdwn',
              text: `*Condition:*\n${payload.condition} ${payload.threshold}`
            },
            {
              type: 'mrkdwn',
              text: `*Current Value:*\n\`${payload.currentValue}\``
            },
            {
              type: 'mrkdwn',
              text: `*Triggered At:*\n${payload.triggeredAt.toISOString()}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Sent by *RicozViz Intelligence OS* · Automated OLAP Alert Engine'
            }
          ]
        }
      ]
    };

    // Use global fetch (Node 18+) with a 6-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'No response body');
      return { success: false, error: `Slack returned HTTP ${response.status}: ${errText}` };
    }

    logger.info('[NotificationService] Slack alert dispatched successfully', {
      alertName: payload.alertName,
      webhookUrl: webhookUrl.replace(/(\/services\/)(.*)/, '$1***')
    });

    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationService] Slack alert dispatch failed', {
      error: errMsg
    });
    return { success: false, error: errMsg };
  }
}

/**
 * Master dispatcher: dispatches to all configured channels (Email & Slack)
 * and returns consolidated delivery status for persistence in AlertHistory.
 */
export async function dispatchAlertNotifications(
  payload: AlertNotificationPayload
): Promise<NotificationDispatchResult> {
  const emailRecipients: string[] = [];
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    emailRecipients.push(...payload.recipients);
  } else if (payload.fallbackEmail) {
    emailRecipients.push(payload.fallbackEmail);
  } else if (process.env.ALERT_FALLBACK_EMAIL) {
    emailRecipients.push(process.env.ALERT_FALLBACK_EMAIL);
  }

  const slackWebhookUrl = payload.slackWebhookUrl || process.env.SLACK_ALERT_WEBHOOK_URL || null;

  const attemptedChannels: string[] = [];
  const successfulChannels: string[] = [];
  const errors: string[] = [];

  // 1. Dispatch Email if recipients available
  if (emailRecipients.length > 0) {
    attemptedChannels.push('EMAIL');
    const emailResult = await sendEmailAlert(emailRecipients, {
      alertName: payload.alertName,
      metricName: payload.metricName,
      condition: payload.condition,
      threshold: payload.threshold,
      currentValue: payload.currentValue,
      triggeredAt: payload.triggeredAt
    });

    if (emailResult.success) {
      successfulChannels.push('EMAIL');
    } else if (emailResult.error) {
      errors.push(`Email error: ${emailResult.error}`);
    }
  }

  // 2. Dispatch Slack if webhook URL available
  if (slackWebhookUrl) {
    attemptedChannels.push('SLACK');
    const slackResult = await sendSlackAlert(slackWebhookUrl, {
      alertName: payload.alertName,
      metricName: payload.metricName,
      condition: payload.condition,
      threshold: payload.threshold,
      currentValue: payload.currentValue,
      triggeredAt: payload.triggeredAt
    });

    if (slackResult.success) {
      successfulChannels.push('SLACK');
    } else if (slackResult.error) {
      errors.push(`Slack error: ${slackResult.error}`);
    }
  }

  if (attemptedChannels.length === 0) {
    return {
      deliveryStatus: 'NOT_CONFIGURED',
      deliveryChannel: null,
      deliveredAt: null,
      deliveryError: 'No email recipients or Slack webhook configured'
    };
  }

  if (successfulChannels.length > 0) {
    return {
      deliveryStatus: 'DELIVERED',
      deliveryChannel: successfulChannels.join(', '),
      deliveredAt: new Date(),
      deliveryError: errors.length > 0 ? errors.join('; ') : null
    };
  }

  return {
    deliveryStatus: 'FAILED',
    deliveryChannel: attemptedChannels.join(', '),
    deliveredAt: null,
    deliveryError: errors.join('; ')
  };
}
