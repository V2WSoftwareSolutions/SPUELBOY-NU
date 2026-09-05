import { createTransport, type Transporter } from 'nodemailer';

import { EMAIL_PATTERN, type ContactRequestFields } from '../shared/contact-rules';

/**
 * Turns a contact request into an e-mail to the sales inbox.
 *
 * Everything the SMTP account needs comes from the environment (see `.env`),
 * so no credential is ever written into the repository. Reading the config,
 * composing the message and sending it are kept apart, so the first two can be
 * tested without a mail server.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  /** Envelope sender — must be an address the SMTP account is allowed to send as. */
  from: string;
  /** Where enquiries land: the SMTP user's own mailbox. */
  to: string;
  /** Port 465 speaks TLS from the first byte; 587 and 25 upgrade with STARTTLS. */
  secure: boolean;
}

export type SmtpConfigResult =
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[] };

const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_ADDRESS'] as const;

/**
 * Reads the SMTP settings out of an environment.
 *
 * A blank value counts as missing, so a half-filled `.env` fails loudly at the
 * endpoint rather than silently dropping enquiries.
 */
export function readSmtpConfig(env: Record<string, string | undefined>): SmtpConfigResult {
  const missing = REQUIRED.filter((key) => !(env[key] ?? '').trim());
  if (missing.length) return { ok: false, missing: [...missing] };

  const host = (env['SMTP_HOST'] ?? '').trim();
  const username = (env['SMTP_USERNAME'] ?? '').trim();
  const password = env['SMTP_PASSWORD'] ?? '';
  const from = (env['SMTP_FROM_ADDRESS'] ?? '').trim();

  const port = Number.parseInt((env['SMTP_PORT'] ?? '').trim(), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, missing: ['SMTP_PORT (must be a port number, e.g. 587)'] };
  }

  // Enquiries go to the SMTP user's mailbox. Some providers use a token as the
  // username (SendGrid's "apikey", for instance), which is not deliverable —
  // in that case the from address is the only mailbox we know of.
  const to = EMAIL_PATTERN.test(username) ? username : from;

  return { ok: true, config: { host, port, username, password, from, to, secure: port === 465 } };
}

export interface ContactMail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Composes the enquiry e-mail.
 *
 * Reply-to is the visitor's own address, so hitting reply in the mail client
 * answers the customer rather than the server's mailbox.
 */
export function buildContactMail(
  request: ContactRequestFields,
  config: SmtpConfig,
  reference: string,
  now = new Date(),
): ContactMail {
  const rows: [string, string][] = [
    ['Name', request.name],
    ['Company', request.company || '—'],
    ['E-mail', request.email],
    ['Phone', request.phone || '—'],
    ['Interested in', request.interestLabel],
    ['Viewing', request.product || '—'],
    ['Reference', reference],
    ['Received', now.toISOString()],
  ];

  const text = [
    `New enquiry from the SPÜLBOY® storefront`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    request.message,
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f6f8f9;padding:24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#333c43">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dde4e9;border-radius:16px;overflow:hidden">
    <div style="background:#e96b12;padding:16px 24px">
      <p style="margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff">SPÜLBOY&reg; storefront</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#fff">New enquiry</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) => `<tr>
        <td style="padding:10px 24px;border-bottom:1px solid #eef1f4;font-size:13px;color:#6c767f;width:150px">${escapeHtml(label)}</td>
        <td style="padding:10px 24px;border-bottom:1px solid #eef1f4;font-size:14px;color:#14181c">${escapeHtml(value)}</td>
      </tr>`,
        )
        .join('\n      ')}
    </table>
    <div style="padding:20px 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#6c767f">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#14181c;white-space:pre-wrap">${escapeHtml(request.message)}</p>
    </div>
  </div>
</body></html>`;

  return {
    from: config.from,
    to: config.to,
    replyTo: request.email,
    subject: `New enquiry — ${request.name} — ${request.interestLabel} (${reference})`,
    text,
    html,
  };
}

let transporter: Transporter | null = null;
let transporterKey = '';

/** One reusable pooled connection per set of credentials. */
function getTransporter(config: SmtpConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.username}`;
  if (!transporter || transporterKey !== key) {
    transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
    });
    transporterKey = key;
  }
  return transporter;
}

export async function sendContactMail(mail: ContactMail, config: SmtpConfig): Promise<void> {
  await getTransporter(config).sendMail(mail);
}
