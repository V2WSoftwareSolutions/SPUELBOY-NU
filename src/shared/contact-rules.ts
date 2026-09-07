/**
 * What a contact request must look like — the one source of truth.
 *
 * The browser form and the server endpoint both import this, so a value the
 * form accepts is exactly a value the server accepts. Nothing here touches
 * Angular or Node, so it runs in both.
 */

/** Letters from any script, then letters, marks, spaces, hyphens, apostrophes and dots. */
export const NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;

/** Something before the @, a domain with at least one dot, and a 2+ letter ending. */
export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/**
 * An Indian mobile number as digits only: exactly ten digits, the first
 * one 6 to 9. No country code, no leading zero.
 */
export const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

export const LIMITS = {
  name: 80,
  company: 120,
  email: 120,
  phone: 10,
  interest: 60,
  interestLabel: 120,
  message: 2000,
  product: 120,
} as const;

export interface ContactRequestFields {
  name: string;
  company: string;
  email: string;
  phone: string;
  /** The chosen option's id, e.g. `nu-portable`. */
  interest: string;
  /** That option's label, e.g. `SPÜLBOY NU® PORTABLE`. */
  interestLabel: string;
  message: string;
  /** Product the visitor was looking at when they asked for the quote. */
  product?: string;
}

export type ContactValidation =
  | { ok: true; value: ContactRequestFields }
  | { ok: false; errors: string[] };

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Checks an untrusted request body and returns the trimmed fields.
 *
 * The server never takes the browser's word for it: the same rules run again
 * here, because anything can post to the endpoint.
 */
export function validateContactRequest(body: unknown): ContactValidation {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['The request body must be an object.'] };
  }

  const raw = body as Record<string, unknown>;
  const name = asText(raw['name']);
  const company = asText(raw['company']);
  const email = asText(raw['email']);
  const phone = asText(raw['phone']);
  const interest = asText(raw['interest']);
  const interestLabel = asText(raw['interestLabel']) || interest;
  const message = asText(raw['message']);
  const product = asText(raw['product']);

  if (!name) errors.push('Name is required.');
  else if (name.length < 2 || name.length > LIMITS.name) errors.push('Name must be 2 to 80 characters.');
  else if (!NAME_PATTERN.test(name)) errors.push('Name may only hold letters, spaces, hyphens and apostrophes.');

  if (company.length > LIMITS.company) errors.push('Company is too long.');

  if (!email) errors.push('E-mail is required.');
  else if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) errors.push('E-mail is not a valid address.');

  // The phone number is optional; when it is given it must be an Indian mobile number.
  if (phone && !PHONE_PATTERN.test(phone)) errors.push('Phone must be a 10-digit Indian mobile number.');

  if (!interest || interest.length > LIMITS.interest) errors.push('An interest must be chosen.');
  if (interestLabel.length > LIMITS.interestLabel) errors.push('Interest label is too long.');

  if (!message) errors.push('Message is required.');
  else if (message.length < 10 || message.length > LIMITS.message) {
    errors.push('Message must be 10 to 2000 characters.');
  }

  if (product.length > LIMITS.product) errors.push('Product is too long.');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: { name, company, email, phone, interest, interestLabel, message, product: product || undefined },
  };
}

/** The reference printed on the enquiry, e.g. `NU-260905-4F2A`. */
export function buildReference(now = new Date(), random = Math.random): string {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `NU-${stamp}-${suffix}`;
}
