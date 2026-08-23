import nodemailer from 'nodemailer';

/**
 * Provider detection — checked once on first send, in this priority order:
 *   1. Resend       RESEND_API_KEY
 *   2. Gmail        GMAIL_USER + GMAIL_APP_PASSWORD
 *   3. SendGrid     SENDGRID_API_KEY
 *   4. Generic SMTP SMTP_HOST (legacy / self-hosted)
 *
 * When none is configured every sendMail() call is silently skipped.
 * Set EMAIL_FROM to override the "From" address for any provider.
 */

let _transport = null;
let _from = null;
let _configured = false;
let _warned = false;

function buildTransport() {
    // ── 1. Resend (SMTP bridge — no extra package needed) ──────────────────
    if (process.env.RESEND_API_KEY) {
        _from = process.env.EMAIL_FROM || 'DreamJob <onboarding@resend.dev>';
        _configured = true;
        return nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 465,
            secure: true,
            auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
        });
    }

    // ── 2. Gmail App Password ────────────────────────────────────────────────
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        _from = process.env.EMAIL_FROM || `DreamJob <${process.env.GMAIL_USER}>`;
        _configured = true;
        return nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
    }

    // ── 3. SendGrid SMTP ─────────────────────────────────────────────────────
    if (process.env.SENDGRID_API_KEY) {
        _from = process.env.EMAIL_FROM || 'DreamJob <no-reply@dreamjob.app>';
        _configured = true;
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
        });
    }

    // ── 4. Generic / self-hosted SMTP (legacy) ───────────────────────────────
    if (process.env.SMTP_HOST) {
        _from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `DreamJob <${process.env.SMTP_USER}>`;
        _configured = true;
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }

    return null;
}

function getTransport() {
    if (_transport) return _transport;
    _transport = buildTransport();
    if (!_transport && !_warned) {
        console.warn(
            '[mailer] No email provider configured — outgoing emails are disabled.\n' +
            '  To enable, add ONE of the following to backend/.env:\n' +
            '    RESEND_API_KEY=re_...           (recommended — resend.com, free tier 3k/month)\n' +
            '    GMAIL_USER + GMAIL_APP_PASSWORD  (Gmail with App Password)\n' +
            '    SENDGRID_API_KEY=SG....          (SendGrid)\n' +
            '    SMTP_HOST=...                    (any SMTP server)'
        );
        _warned = true;
    }
    return _transport;
}

/**
 * Wrap arbitrary HTML content in a branded email shell.
 * All outgoing emails are passed through this automatically in sendMail().
 * Export it so controllers can also use it to preview template output.
 */
export function wrapEmailHtml(content) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>DreamJob</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background-color:#6366f1;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center">
            <p style="margin:0;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.5px">
              DreamJob
            </p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.70);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px">
              Your career companion
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#334155">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;padding:20px 40px;text-align:center">
            <p style="margin:0;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6">
              &copy; ${year} DreamJob &mdash; All rights reserved.<br>
              You&rsquo;re receiving this because you have an account on DreamJob.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send a transactional email.
 * html is automatically wrapped in the branded shell — pass raw content HTML only.
 * Silently returns (no throw) when no provider is configured.
 * Throws on actual send errors so callers can .catch() them.
 */
export const sendMail = async ({ to, subject, html, text, attachments }) => {
    const transport = getTransport();
    if (!transport || !to) return;

    const plainText = text
        || (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        || subject;

    try {
        await transport.sendMail({
            from: _from,
            to,
            subject,
            html: wrapEmailHtml(html || ''),
            text: plainText,
            ...(attachments ? { attachments } : {}),
        });
    } catch (err) {
        console.error(`[mailer] Send failed — to:${to} subject:"${subject}" error:${err.message}`);
        throw err;
    }
};
