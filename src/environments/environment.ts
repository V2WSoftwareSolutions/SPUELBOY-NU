/**
 * Runtime configuration for the storefront.
 *
 * `contactEndpoint` points at this app's own SSR server, which e-mails the
 * enquiry to the sales mailbox over SMTP (see `src/server.ts` and `.env`).
 * Set it to an absolute URL to post to a different backend instead; set it to
 * an empty string and the form resolves locally without sending anything.
 */
export const environment = {
  production: false,
  contactEndpoint: '/api/contact',
};
