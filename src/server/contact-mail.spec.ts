import { describe, expect, it } from 'vitest';

import { validateContactRequest, buildReference } from '../shared/contact-rules';
import { buildContactMail, readSmtpConfig, type SmtpConfig } from './contact-mail';

const ENV = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USERNAME: 'sales@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM_ADDRESS: 'website@example.com',
};

const REQUEST = {
  name: 'Sam Wirt',
  company: 'Zum Anker',
  email: 'sam@example.com',
  phone: '9966879792',
  interest: 'nu-portable',
  interestLabel: 'SPÜLBOY NU® PORTABLE',
  message: 'Please send me a quote for two portable devices.',
};

describe('readSmtpConfig', () => {
  it('reads a complete environment and sends enquiries to the SMTP user', () => {
    const result = readSmtpConfig(ENV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      to: 'sales@example.com',
      from: 'website@example.com',
      secure: false,
    });
  });

  it('turns TLS on for port 465 and off for 587', () => {
    const implicit = readSmtpConfig({ ...ENV, SMTP_PORT: '465' });
    expect(implicit.ok && implicit.config.secure).toBe(true);
  });

  it('names every missing or blank setting instead of half-configuring', () => {
    const result = readSmtpConfig({ ...ENV, SMTP_HOST: '', SMTP_PASSWORD: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(['SMTP_HOST', 'SMTP_PASSWORD']);
  });

  it('rejects a port that is not a port', () => {
    const result = readSmtpConfig({ ...ENV, SMTP_PORT: 'mail' });
    expect(result.ok).toBe(false);
  });

  it('falls back to the from address when the username is a token, not a mailbox', () => {
    // SendGrid and friends use a literal "apikey" as the SMTP username.
    const result = readSmtpConfig({ ...ENV, SMTP_USERNAME: 'apikey' });
    expect(result.ok && result.config.to).toBe('website@example.com');
  });
});

describe('validateContactRequest', () => {
  it('accepts a filled-in enquiry and trims it', () => {
    const result = validateContactRequest({ ...REQUEST, name: '  Sam Wirt  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Sam Wirt');
    expect(result.value.product).toBeUndefined();
  });

  it('accepts an enquiry with no company and no phone', () => {
    const result = validateContactRequest({ ...REQUEST, company: '', phone: '' });
    expect(result.ok).toBe(true);
  });

  it('re-runs the browser rules, so a forged post is refused', () => {
    const result = validateContactRequest({ ...REQUEST, name: 'Sam1', email: 'sam@example', phone: '+49202' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(3);
  });

  it('refuses a body that is not an object', () => {
    expect(validateContactRequest('nope').ok).toBe(false);
    expect(validateContactRequest(null).ok).toBe(false);
  });

  it('falls back to the interest id when no label is sent', () => {
    const { interestLabel: _label, ...withoutLabel } = REQUEST;
    const result = validateContactRequest(withoutLabel);
    expect(result.ok && result.value.interestLabel).toBe('nu-portable');
  });
});

describe('buildContactMail', () => {
  const config = (readSmtpConfig(ENV) as { ok: true; config: SmtpConfig }).config;
  const mail = buildContactMail(
    { ...REQUEST, company: '', product: 'SPÜLBOY NU® BUILT-IN' },
    config,
    'NU-260905-4F2A',
    new Date('2026-09-05T09:30:00.000Z'),
  );

  it('sends from the configured address to the sales mailbox, replying to the customer', () => {
    expect(mail.from).toBe('website@example.com');
    expect(mail.to).toBe('sales@example.com');
    expect(mail.replyTo).toBe('sam@example.com');
    expect(mail.subject).toContain('Sam Wirt');
    expect(mail.subject).toContain('NU-260905-4F2A');
  });

  it('carries every field the sales team needs, with a dash where nothing was given', () => {
    for (const value of ['Sam Wirt', 'sam@example.com', '9966879792', 'SPÜLBOY NU® PORTABLE', 'SPÜLBOY NU® BUILT-IN']) {
      expect(mail.text, value).toContain(value);
    }
    expect(mail.text).toContain('Company: —');
    expect(mail.text).toContain(REQUEST.message);
  });

  it('escapes the visitor’s text so a pasted tag cannot become markup', () => {
    const nasty = buildContactMail(
      { ...REQUEST, message: 'Quote for <script>alert(1)</script> & "two" devices, please.' },
      config,
      'NU-260905-0001',
    );
    expect(nasty.html).not.toContain('<script>');
    expect(nasty.html).toContain('&lt;script&gt;');
    expect(nasty.html).toContain('&amp;');
  });
});

describe('buildReference', () => {
  it('stamps the date and a four-character suffix', () => {
    expect(buildReference(new Date('2026-09-05T00:00:00.000Z'), () => 0.5)).toMatch(/^NU-260905-[A-Z0-9]{4}$/);
  });
});
